async function testKoreanToSQL() {
  const testCases = [
    "급여가 5천만원 이상인 직원 찾기",
    "개발팀 직원 목록 보여줘",
    "급여가 높은 직원 5명",
    "이름에 김이 들어간 직원"
  ];

  for (const query of testCases) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 한글 쿼리:', query);
    console.log('='.repeat(60));

    try {
      const response = await fetch('http://localhost:8787/api/generate-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({ userQuery: query })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ 성공!');
        console.log('📝 생성된 SQL:', result.generatedSQL);
        console.log('📊 결과 행 수:', result.meta.rows);
        if (result.data.length > 0) {
          console.log('📋 첫 번째 결과:', JSON.stringify(result.data[0], null, 2));
        }
      } else {
        console.log('❌ 실패:', result.error);
      }
    } catch (error) {
      console.log('❌ 에러:', error.message);
    }

    // 다음 요청까지 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

testKoreanToSQL();
