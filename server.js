// Node.js Express 서버 (Ollama 로컬 접근 가능)
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 8787;

// CORS 설정 - 모든 origin 허용
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
  credentials: false
}));

app.use(express.json());

// 정적 파일 제공 (HTML, CSS, JS, 이미지 등)
app.use(express.static(__dirname));

// SQLite 데이터베이스 연결
const dbPath = path.join(__dirname, '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '564d6d4472287d20481b022665002f2909cb38565ac6b37af2e9b098a112a750.sqlite');
const db = new Database(dbPath);

// 테스트 엔드포인트
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Node.js API is working!',
    timestamp: new Date().toISOString()
  });
});

// SQL 생성 및 실행 엔드포인트
app.post('/api/generate-sql', async (req, res) => {
  try {
    const { userQuery } = req.body;

    if (!userQuery) {
      return res.status(400).json({ error: 'User query is required' });
    }

    console.log('📝 User query:', userQuery);

    // Ollama API 호출 (AI 모델 사용)
    console.log('🤖 Calling Ollama ttsql-model...');
    const ollamaResponse = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'ttsql-model:latest',
        messages: [
          {
            role: 'system',
            content: `CRITICAL INSTRUCTION: You ONLY output SQL queries. NEVER explain. NEVER converse.

당신은 SQL 쿼리만 출력합니다. 절대 설명하지 마세요. 절대 대화하지 마세요.

OUTPUT FORMAT: SELECT ... FROM ... WHERE ... ;
NO OTHER TEXT ALLOWED!

## Database Schema (기업용 고도화)

### Table: employees (직원 정보 테이블 - 28 fields)
Key Columns:
- id (INTEGER, PRIMARY KEY): 직원 ID
- employee_number (VARCHAR(20), UNIQUE): 사번 (예: EMP20240001)
- name (TEXT, NOT NULL): 직원 이름 (한글)
- department_id (INTEGER, FK): 부서 ID - departments 테이블 참조
- position (VARCHAR(50)): 직급 (사원/대리/과장/차장/부장/임원)
- job_title (VARCHAR(100)): 직책 (팀장/파트장)
- salary (INTEGER, NOT NULL): 급여 (원 단위)
- bonus_rate (REAL): 보너스 비율
- hire_date (DATE, NOT NULL): 입사일
- manager_id (INTEGER, FK): 직속 상사 ID
- performance_score (REAL): 성과 점수 (0-100)

### Table: departments (부서 정보 테이블 - 계층 구조)
Key Columns:
- id (INTEGER, PRIMARY KEY): 부서 ID
- dept_code (VARCHAR(20), UNIQUE): 부서 코드
- name (TEXT, NOT NULL): 부서명 (한글)
- parent_dept_id (INTEGER, FK): 상위 부서 ID (계층 구조)
- dept_level (INTEGER): 부서 레벨 (1=본부, 2=팀, 3=파트)
- manager_id (INTEGER, FK): 부서장 ID
- budget (INTEGER): 예산
- employee_count (INTEGER): 소속 직원 수

### Important: 부서명 조회 시 JOIN 필수
❌ 잘못된 예: SELECT name, department FROM employees WHERE department = '개발팀';
✅ 올바른 예: SELECT e.name, d.name as department FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.name = '개발팀';

## Important Rules

1. **Database Type**: SQLite (MUST use SQLite-specific syntax)
2. **Korean Currency Conversion** (CRITICAL - NEVER GET THIS WRONG):
   - 1만원 = 10000 (four zeros: 0000)
   - 100만원 = 1000000 (six zeros: 000000)
   - 1천만원 = 10000000 (seven zeros: 0000000)
   - 5천만원 = 50000000 (EXACTLY 50 followed by six zeros)
   - 5800만원 = 58000000 (58 followed by six zeros)
   - 6천만원 = 60000000 (60 followed by six zeros)
   - 7천만원 = 70000000 (70 followed by six zeros)
   - 1억 = 100000000 (1 followed by eight zeros: 00000000)
   - **FORMULA**: X천만원 = X * 10000000 (X times ten million)
   - **FORMULA**: X백만원 = X * 1000000 (X times one million)
   - **FORMULA**: X만원 = X * 10000 (X times ten thousand)
3. **SQLite-Specific Date Functions** (CRITICAL):
   - ❌ NEVER use: YEAR(), MONTH(), DAY() - These do NOT exist in SQLite
   - ✅ ALWAYS use: strftime() function for date operations
   - Year extraction: strftime('%Y', hire_date)
   - Month extraction: strftime('%m', hire_date)
   - Day extraction: strftime('%d', hire_date)
   - Date comparison: Use string comparison or strftime()
   - Example: WHERE strftime('%Y', hire_date) = '2023'
   - Example: WHERE hire_date >= '2023-01-01' AND hire_date < '2024-01-01'
4. **Other SQLite-Specific Functions**:
   - String concatenation: Use || operator (e.g., name || ' ' || department)
   - No CONCAT() function in SQLite
   - Use IFNULL() instead of COALESCE() when possible
   - LIMIT clause is supported and preferred for row limiting
5. **Response Format**: ONLY return ONE SQL query, NO explanations, NO multiple statements
6. **Query Type**: Only SELECT queries are allowed
7. **Korean Support**: Understand Korean queries and generate appropriate SQL

## Example Queries (신 스키마 - JOIN 사용)

Korean: "급여가 5천만원 이상인 직원"
SQL: SELECT e.name, e.salary, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.salary >= 50000000;

Korean: "개발팀 직원 목록"
SQL: SELECT e.name, e.salary, e.hire_date, d.name as department FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.name LIKE '%개발%';

Korean: "급여가 높은 직원 5명"
SQL: SELECT e.name, e.position, e.salary, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id ORDER BY e.salary DESC LIMIT 5;

Korean: "부서별 평균 급여"
SQL: SELECT d.name as department, AVG(e.salary) as avg_salary FROM employees e JOIN departments d ON e.department_id = d.id GROUP BY d.name;

Korean: "2023년에 입사한 직원"
SQL: SELECT e.name, d.name as department, e.hire_date FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE strftime('%Y', e.hire_date) = '2023';

Korean: "부장급 이상 직원"
SQL: SELECT e.name, e.position, e.salary, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE e.position IN ('부장', '임원', '대표이사', '부사장');

Korean: "직급별 평균 급여"
SQL: SELECT position, AVG(salary) as avg_salary, COUNT(*) as count FROM employees GROUP BY position ORDER BY avg_salary DESC;

CRITICAL: Output ONLY the SQL query with a semicolon at the end. NO explanations!`
          },
          {
            role: 'user',
            content: userQuery
          }
        ],
        max_tokens: 150,
        temperature: 0.0,
        top_p: 0.1,
        top_k: 1
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.status}`);
    }

    const ollamaData = await ollamaResponse.json();
    let sql = ollamaData.choices[0]?.message?.content?.trim();

    // SQL에서 마크다운 코드 블록과 설명 제거
    if (sql.includes('```')) {
      // 마크다운 코드 블록 추출
      const codeBlockMatch = sql.match(/```(?:sql)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        sql = codeBlockMatch[1].trim();
      }
    }

    // 세미콜론 이후의 모든 텍스트 제거 (설명 제거)
    const firstSemicolon = sql.indexOf(';');
    if (firstSemicolon !== -1) {
      sql = sql.substring(0, firstSemicolon + 1).trim();
    }

    console.log('✅ Generated SQL:', sql);

    // AI가 제대로 SQL을 생성하지 못한 경우 에러 처리
    if (!sql || !sql.toLowerCase().startsWith('select')) {
      throw new Error('AI failed to generate valid SQL query');
    }

    // SQL 실행
    const stmt = db.prepare(sql);
    const results = stmt.all();

    console.log('📊 Results:', results.length, 'rows');

    res.json({
      success: true,
      userQuery,
      generatedSQL: sql,
      data: results,
      meta: {
        rows: results.length
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 스키마 정보 엔드포인트
app.get('/api/schema', (req, res) => {
  const schema = {
    employees: {
      columns: ['id', 'name', 'department', 'salary', 'hire_date'],
      description: '직원 정보 테이블'
    },
    departments: {
      columns: ['id', 'name', 'manager_id', 'budget'],
      description: '부서 정보 테이블'
    },
    projects: {
      columns: ['id', 'name', 'start_date', 'end_date', 'budget'],
      description: '프로젝트 정보 테이블'
    },
    employee_projects: {
      columns: ['employee_id', 'project_id', 'role'],
      description: '직원-프로젝트 관계 테이블'
    }
  };

  res.json({
    success: true,
    schema
  });
});

// 규칙 기반 SQL 생성 함수
function generateRuleBasedSQL(userQuery) {
  const query = userQuery.toLowerCase();

  // 부서로 시작하는 패턴 (우선순위 높음)
  if (query.includes('부서가') && query.includes('시작')) {
    const match = query.match(/['"]([^'"]+)['"]/);
    const deptPattern = match ? match[1] : '개발';
    return `SELECT e.name, e.salary, e.hire_date, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE d.name LIKE '${deptPattern}%';`;
  }

  // 개발 관련 (팀, 본부 모두 포함)
  if (query.includes('개발')) {
    return "SELECT e.name, e.salary, e.hire_date, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE d.name LIKE '%개발%';";
  }

  // 급여 높은 순
  if (query.includes('급여') && (query.includes('높은') || query.includes('상위'))) {
    const limitMatch = query.match(/(\d+)명/);
    const limit = limitMatch ? limitMatch[1] : '5';
    return `SELECT e.name, e.position, e.salary, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id ORDER BY e.salary DESC LIMIT ${limit};`;
  }

  // 전체 직원
  if (query.includes('모든') || (query.includes('전체') && query.includes('직원'))) {
    return "SELECT e.name, e.salary, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id LIMIT 10;";
  }

  // 전체 프로젝트
  if (query.includes('프로젝트') && (query.includes('모든') || query.includes('전체'))) {
    return "SELECT * FROM projects;";
  }

  // 기본
  return "SELECT e.name, e.salary, d.name as department FROM employees e LEFT JOIN departments d ON e.department_id = d.id LIMIT 10;";
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${dbPath}`);
  console.log(`🤖 Ollama: http://localhost:11434`);
});
