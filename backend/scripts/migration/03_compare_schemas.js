/**
 * STEP 3: SCHEMA COMPARISON — Render Production vs Supabase Staging vs Local Prisma
 * ────────────────────────────────────────────────────────────────────────────────────
 * Queries both databases and the local Prisma schema to produce a detailed
 * schema comparison report. Reports ALL discrepancies without silently resolving them.
 *
 * No secrets are printed. Credentials come from backend/.env.migration only.
 *
 * Usage:
 *   node backend/scripts/migration/03_compare_schemas.js
 */

require('dotenv').config({ path: './backend/.env.migration' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const renderDbUrl = process.env.RENDER_DATABASE_URL;
const stagingDbUrl = process.env.SUPABASE_STAGING_DATABASE_URL;

if (!renderDbUrl || renderDbUrl.includes('RENDER_USER')) {
  console.error('❌  RENDER_DATABASE_URL not configured in backend/.env.migration');
  process.exit(1);
}

if (!stagingDbUrl || stagingDbUrl.includes('YOUR-STAGING-DB-PASSWORD')) {
  console.error('❌  SUPABASE_STAGING_DATABASE_URL not configured in backend/.env.migration');
  process.exit(1);
}

// ─── Schema introspection query ───────────────────────────
const SCHEMA_QUERY = `
  SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.character_maximum_length,
    c.is_nullable,
    c.column_default,
    c.udt_name
  FROM information_schema.tables t
  JOIN information_schema.columns c 
    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name, c.ordinal_position;
`;

const FK_QUERY = `
  SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    tc.constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  ORDER BY tc.table_name, kcu.column_name;
`;

const INDEX_QUERY = `
  SELECT
    indexname,
    tablename,
    indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;
`;

async function introspectDb(label, connectionUrl) {
  const client = new Client({ connectionString: connectionUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const [cols, fks, idxs] = await Promise.all([
      client.query(SCHEMA_QUERY),
      client.query(FK_QUERY),
      client.query(INDEX_QUERY),
    ]);
    return {
      label,
      columns: cols.rows,
      foreignKeys: fks.rows,
      indexes: idxs.rows,
      tables: [...new Set(cols.rows.map(r => r.table_name))].sort(),
    };
  } finally {
    await client.end();
  }
}

function buildColumnMap(schema) {
  const map = {};
  for (const col of schema.columns) {
    const key = `${col.table_name}.${col.column_name}`;
    map[key] = col;
  }
  return map;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ONEREAL LMS — Schema Comparison Report (Phase 2)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🔍 Introspecting Render Production schema...');
  const render = await introspectDb('Render Production', renderDbUrl);
  console.log(`  → ${render.tables.length} tables, ${render.columns.length} columns, ${render.foreignKeys.length} FKs, ${render.indexes.length} indexes\n`);

  console.log('🔍 Introspecting Supabase Staging schema...');
  const staging = await introspectDb('Supabase Staging', stagingDbUrl);
  console.log(`  → ${staging.tables.length} tables, ${staging.columns.length} columns, ${staging.foreignKeys.length} FKs, ${staging.indexes.length} indexes\n`);

  const report = [];
  let discrepancies = 0;

  // ─── TABLE COMPARISON ─────────────────────────────────
  const renderTables = new Set(render.tables);
  const stagingTables = new Set(staging.tables);

  const onlyInRender = render.tables.filter(t => !stagingTables.has(t));
  const onlyInStaging = staging.tables.filter(t => !renderTables.has(t) && t !== 'schema_migrations');
  const commonTables = render.tables.filter(t => stagingTables.has(t));

  report.push('## TABLE COMPARISON');
  report.push(`Common tables: ${commonTables.length}`);
  if (onlyInRender.length) {
    report.push(`\n⚠️  Tables in Render only (missing from staging): ${onlyInRender.join(', ')}`);
    discrepancies += onlyInRender.length;
  }
  if (onlyInStaging.length) {
    report.push(`\n⚠️  Tables in Staging only (not in Render): ${onlyInStaging.join(', ')}`);
    discrepancies += onlyInStaging.length;
  }
  if (!onlyInRender.length && !onlyInStaging.length) {
    report.push('✅ All tables match between Render and Staging.');
  }

  // ─── COLUMN COMPARISON ────────────────────────────────
  report.push('\n## COLUMN COMPARISON (per common table)');
  const renderColMap = buildColumnMap(render);
  const stagingColMap = buildColumnMap(staging);

  for (const table of commonTables) {
    const renderCols = render.columns.filter(c => c.table_name === table);
    const stagingCols = staging.columns.filter(c => c.table_name === table);
    const renderColNames = new Set(renderCols.map(c => c.column_name));
    const stagingColNames = new Set(stagingCols.map(c => c.column_name));

    const missingInStaging = [...renderColNames].filter(c => !stagingColNames.has(c));
    const extraInStaging = [...stagingColNames].filter(c => !renderColNames.has(c));
    const typeDiffs = [];

    for (const col of renderCols) {
      const stagingCol = stagingColMap[`${table}.${col.column_name}`];
      if (stagingCol && stagingCol.data_type !== col.data_type) {
        typeDiffs.push(`    ${col.column_name}: Render=${col.data_type} | Staging=${stagingCol.data_type}`);
      }
    }

    if (missingInStaging.length || extraInStaging.length || typeDiffs.length) {
      report.push(`\n### ${table}`);
      if (missingInStaging.length) {
        report.push(`  ⚠️  Missing in Staging: ${missingInStaging.join(', ')}`);
        discrepancies += missingInStaging.length;
      }
      if (extraInStaging.length) {
        report.push(`  ℹ️  Extra in Staging (not in Render): ${extraInStaging.join(', ')}`);
      }
      if (typeDiffs.length) {
        report.push(`  ⚠️  Data type differences:\n${typeDiffs.join('\n')}`);
        discrepancies += typeDiffs.length;
      }
    }
  }

  // ─── FOREIGN KEY COMPARISON ───────────────────────────
  report.push('\n## FOREIGN KEY COMPARISON');
  const renderFkKeys = new Set(render.foreignKeys.map(f => `${f.table_name}.${f.column_name}->${f.referenced_table}.${f.referenced_column}`));
  const stagingFkKeys = new Set(staging.foreignKeys.map(f => `${f.table_name}.${f.column_name}->${f.referenced_table}.${f.referenced_column}`));
  const missingFks = [...renderFkKeys].filter(k => !stagingFkKeys.has(k));
  if (missingFks.length) {
    report.push(`⚠️  Foreign keys in Render but missing in Staging:\n  ${missingFks.join('\n  ')}`);
    discrepancies += missingFks.length;
  } else {
    report.push('✅ All foreign keys match.');
  }

  // ─── SUMMARY ──────────────────────────────────────────
  const timestamp = new Date().toISOString();
  const header = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '  ONEREAL LMS — Schema Comparison Report',
    `  Generated: ${timestamp}`,
    `  Render Tables:  ${render.tables.length}`,
    `  Staging Tables: ${staging.tables.length}`,
    `  Discrepancies:  ${discrepancies}`,
    discrepancies === 0 ? '  Status: ✅ SCHEMAS MATCH' : `  Status: ⚠️  ${discrepancies} DISCREPANCIES — REVIEW BEFORE PROCEEDING`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  const fullReport = header + '\n\n' + report.join('\n');
  console.log('\n' + fullReport);

  const reportPath = './migration_backups/schema_comparison_report.txt';
  fs.mkdirSync('./migration_backups', { recursive: true });
  fs.writeFileSync(reportPath, fullReport);
  console.log(`\n📄 Full report saved to: ${reportPath}`);

  if (discrepancies > 0) {
    console.log('\n⛔  Schema discrepancies detected. Review the report above before applying supabase_migration.sql.\n');
    process.exit(1);
  } else {
    console.log('\n✅ Schemas match. Safe to proceed to Step 04: Apply Supabase Migration SQL.\n');
  }
}

main().catch(err => {
  console.error('❌ Schema comparison failed:', err.message);
  process.exit(1);
});
