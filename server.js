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
  allowedHeaders: ['Content-Type'],
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

    // Ollama API 호출
    console.log('🤖 Calling Ollama ttsql-model...');
    const ollamaResponse = await fetch('http://localhost:11434/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen2.5-coder:7b',
        messages: [
          {
            role: 'system',
            content: `You are an expert SQL developer specialized in converting Korean natural language queries to SQL queries.
당신은 한국어를 SQL로 변환하는 전문가입니다.

## Database Schema

### Table: employees (직원 정보 테이블)
Columns:
- id (INTEGER, PRIMARY KEY): 직원 ID
- name (TEXT, NOT NULL): 직원 이름 (한글)
- department (TEXT, NOT NULL): 부서명 (한글)
- salary (INTEGER, NOT NULL): 급여 (원 단위)
- hire_date (DATE, NOT NULL): 입사일 (YYYY-MM-DD 형식)

## Important Rules

1. **Database Type**: SQLite
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
3. **Response Format**: ONLY return ONE SQL query, NO explanations, NO multiple statements
4. **Query Type**: Only SELECT queries are allowed
5. **Korean Support**: Understand Korean queries and generate appropriate SQL

## Example Queries

Korean: "급여가 5천만원 이상인 직원"
SQL: SELECT name, department, salary FROM employees WHERE salary >= 50000000;

Korean: "개발팀 직원 목록"
SQL: SELECT name, salary, hire_date FROM employees WHERE department = '개발팀';

Korean: "급여가 높은 직원 5명"
SQL: SELECT name, department, salary FROM employees ORDER BY salary DESC LIMIT 5;

CRITICAL: Output ONLY the SQL query with a semicolon at the end. NO explanations!`
          },
          {
            role: 'user',
            content: userQuery
          }
        ],
        max_tokens: 200,
        temperature: 0.1
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${dbPath}`);
  console.log(`🤖 Ollama: http://localhost:11434`);
});
