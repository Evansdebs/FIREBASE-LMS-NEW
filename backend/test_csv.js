try {
  const { Parser } = require('json2csv');
  console.log('Parser found:', !!Parser);
  const p = new Parser();
  console.log('Instance created');
} catch (e) {
  console.error('Error:', e.message);
  try {
    const json2csv = require('json2csv');
    console.log('Library keys:', Object.keys(json2csv));
  } catch (e2) {
    console.error('Library not found');
  }
}
