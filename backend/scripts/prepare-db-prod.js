const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
console.log('🔄 Preparing Prisma schema for production database...');

if (fs.existsSync(schemaPath)) {
  let schema = fs.readFileSync(schemaPath, 'utf8');
  
  // Replace sqlite provider with postgresql
  schema = schema.replace(
    'provider = "sqlite"',
    'provider = "postgresql"'
  );
  
  fs.writeFileSync(schemaPath, schema);
  console.log('✅ Prisma schema updated to use postgresql provider.');
} else {
  console.error('❌ schema.prisma file not found!');
  process.exit(1);
}
