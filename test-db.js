// 데이터베이스 연결 테스트
const Database = require('better-sqlite3');
const path = require('path');

// 두 개의 데이터베이스 파일 모두 테스트
const dbPath1 = path.join(__dirname, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '6c3eca51-e15b-46a3-93a2-fb8a4c7a1393.sqlite');
const dbPath2 = path.join(__dirname, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '564d6d4472287d20481b022665002f2909cb38565ac6b37af2e9b098a112a750.sqlite');

// 첫 번째 DB 테스트
console.log('\n=== Testing DB 1 ===');
const dbPath = dbPath1;

console.log('📂 Database path:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  console.log('✅ Database opened successfully');

  // 테이블 목록 확인
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📊 Tables:', tables.map(t => t.name).join(', '));

  // employees 테이블 데이터 확인
  const employees = db.prepare("SELECT * FROM employees LIMIT 3").all();
  console.log('👥 Employees:', employees);

  db.close();
  console.log('✅ Database test completed successfully');
} catch (error) {
  console.error('❌ Database error:', error.message);
}

// 두 번째 DB 테스트
console.log('\n=== Testing DB 2 ===');
console.log('📂 Database path:', dbPath2);

try {
  const db2 = new Database(dbPath2, { readonly: true });
  console.log('✅ Database opened successfully');

  // 테이블 목록 확인
  const tables = db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📊 Tables:', tables.map(t => t.name).join(', '));

  // employees 테이블 데이터 확인
  if (tables.some(t => t.name === 'employees')) {
    const employees = db2.prepare("SELECT * FROM employees LIMIT 3").all();
    console.log('👥 Employees:', employees);
  }

  db2.close();
  console.log('✅ Database test completed successfully');
} catch (error) {
  console.error('❌ Database error:', error.message);
}
