// Cloudflare Workers API for TTSQL

// Rate Limiting (메모리 기반 - 간단한 구현)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1분
const RATE_LIMIT_MAX_REQUESTS = 20; // 분당 20회

function getRateLimitKey(request) {
  // CF-Connecting-IP 헤더에서 실제 클라이언트 IP 가져오기
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}

function checkRateLimit(clientId) {
  const now = Date.now();
  const key = `rate_${clientId}`;
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  const limitData = rateLimitMap.get(key);
  
  // 윈도우가 지났으면 리셋
  if (now - limitData.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  // 현재 윈도우에서 제한 확인
  if (limitData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  
  limitData.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - limitData.count };
}

export default {
  async fetch(request, env, ctx) {
    // 보안 강화된 CORS 설정
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://cop-ttsql.pages.dev',
      env.ALLOWED_ORIGIN || 'http://localhost:3000'
    ];
    
    const origin = request.headers.get('Origin');
    const isAllowedOrigin = allowedOrigins.includes(origin);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'false'
    };

    // OPTIONS 요청 처리 (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    // Rate Limiting 검사 (POST 요청에만 적용)
    if (request.method === 'POST') {
      const clientId = getRateLimitKey(request);
      const rateLimitResult = checkRateLimit(clientId);
      
      if (!rateLimitResult.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          message: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
          retryAfter: 60
        }), {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + 60).toString(),
            'Retry-After': '60'
          }
        });
      }
      
      // Rate limit 헤더 추가
      corsHeaders['X-RateLimit-Limit'] = RATE_LIMIT_MAX_REQUESTS.toString();
      corsHeaders['X-RateLimit-Remaining'] = rateLimitResult.remaining.toString();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // API 라우팅
      if (path === '/api/test' && request.method === 'GET') {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Workers API is working!',
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else if (path === '/api/execute-sql' && request.method === 'POST') {
        return await handleExecuteSQL(request, env, corsHeaders);
      } else if (path === '/api/generate-sql' && request.method === 'POST') {
        return await handleGenerateSQL(request, env, corsHeaders);
      } else if (path === '/api/generate-hive' && request.method === 'POST') {
        return await handleGenerateHiveSQL(request, env, corsHeaders);
      } else if (path === '/api/execute-hive' && request.method === 'POST') {
        return await handleExecuteHiveSQL(request, env, corsHeaders);
      } else if (path === '/api/generate-sybase' && request.method === 'POST') {
        return await handleGenerateSybaseSQL(request, env, corsHeaders);
      } else if (path === '/api/execute-sybase' && request.method === 'POST') {
        return await handleExecuteSybaseSQL(request, env, corsHeaders);
      } else if (path === '/api/schema' && request.method === 'GET') {
        return await handleGetSchema(request, env, corsHeaders);
      } else if (path === '/api/debug-chatgpt' && request.method === 'POST') {
        return await handleDebugChatGPT(request, env, corsHeaders);
      } else {
        return new Response('Not Found', { 
          status: 404, 
          headers: corsHeaders 
        });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }), {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      });
    }
  },
};

// SQL 보안 검증 함수 (개선된 버전)
function validateSQL(sql) {
  // SQL 정규화 (소문자 변환, 공백 정리)
  const normalizedSQL = sql.toLowerCase().trim();
  
  // 위험한 키워드 차단 (세미콜론 제외)
  const dangerousKeywords = [
    'drop', 'delete', 'insert', 'update', 'alter', 'create',
    'truncate', 'grant', 'revoke', 'exec', 'execute',
    'union', 'information_schema', 'pg_', 'mysql.',
    'xp_', 'sp_', '--', '/*', '*/'
  ];
  
  for (const keyword of dangerousKeywords) {
    if (normalizedSQL.includes(keyword)) {
      throw new Error(`보안상 위험한 키워드가 감지되었습니다: ${keyword}`);
    }
  }
  
  // SELECT 문만 허용 (세미콜론은 허용)
  const cleanSQL = normalizedSQL.replace(/;+$/, ''); // 끝의 세미콜론 제거 후 검사
  if (!cleanSQL.startsWith('select')) {
    throw new Error('SELECT 문만 허용됩니다.');
  }
  
  // SQL 길이 제한 (2KB)
  if (sql.length > 2048) {
    throw new Error('SQL 쿼리가 너무 깁니다.');
  }
  
  // 여러 개의 SQL 문 차단 (세미콜론으로 구분된 여러 문장)
  const sqlStatements = sql.split(';').filter(stmt => stmt.trim());
  if (sqlStatements.length > 1) {
    throw new Error('하나의 SELECT 문만 허용됩니다.');
  }
  
  return true;
}

// SQL 실행 핸들러 (한글 인코딩 개선)
async function handleExecuteSQL(request, env, corsHeaders) {
  try {
    const { sql } = await request.json();
    
    if (!sql) {
      return new Response(JSON.stringify({ error: 'SQL query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // SQL 보안 검증
    try {
      validateSQL(sql);
    } catch (validationError) {
      return new Response(JSON.stringify({ 
        error: '보안 검증 실패',
        details: validationError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    console.log('Executing SQL:', sql);
    
    // D1 데이터베이스에서 SQL 실행 (한글 인코딩 처리)
    const stmt = env.DB.prepare(sql);
    const result = await stmt.all();
    
    console.log('SQL result:', result);

    return new Response(JSON.stringify({
      success: true,
      data: result.results,
      meta: result.meta
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (error) {
    console.error('SQL execution error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'SQL execution failed',
      message: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}

// ChatGPT를 통한 SQL 생성 + 실행 핸들러
async function handleGenerateSQL(request, env, corsHeaders) {
  try {
    console.log('Starting handleGenerateSQL...');
    
    const requestBody = await request.json();
    console.log('Request body:', requestBody);
    
    const { userQuery } = requestBody;
    
    if (!userQuery) {
      console.log('Missing userQuery');
      return new Response(JSON.stringify({
        error: 'User query is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 스키마 정보 가져오기
    console.log('Getting schema info...');
    const schemaInfo = await getSchemaInfo(env.DB);
    console.log('Schema info:', schemaInfo);

    // Ollama로 SQL 생성
    console.log('Calling Ollama AI...');
    let generatedSQL = await generateSQLWithAI(userQuery, schemaInfo, null);
    console.log('AI result:', generatedSQL);
    
    if (!generatedSQL.success) {
      // AI 생성 실패시 최후 규칙 기반 폴백
      console.log('AI generation failed, using emergency rule-based generation');
      try {
        const fallbackSQL = await generateSQLWithRules(userQuery, schemaInfo);
        
        if (fallbackSQL.success) {
          generatedSQL = fallbackSQL;
          console.log('Emergency fallback successful:', fallbackSQL.sql);
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'SQL generation failed',
            message: 'AI와 규칙 기반 생성 모두 실패했습니다.',
            userQuery
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (fallbackError) {
        console.error('Emergency fallback error:', fallbackError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Complete SQL generation failure',
          message: fallbackError.message,
          userQuery
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 생성된 SQL 보안 검증
    try {
      validateSQL(generatedSQL.sql);
    } catch (validationError) {
      return new Response(JSON.stringify({
        success: false,
        error: '생성된 SQL이 보안 검증에 실패했습니다',
        details: validationError.message,
        userQuery
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 생성된 SQL 실행
    try {
      const stmt = env.DB.prepare(generatedSQL.sql);
      const result = await stmt.all();

      return new Response(JSON.stringify({
        success: true,
        userQuery,
        generatedSQL: generatedSQL.sql,
        data: result.results,
        meta: result.meta
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });

    } catch (sqlError) {
      console.error('Generated SQL execution error:', sqlError);
      return new Response(JSON.stringify({
        success: false,
        userQuery,
        generatedSQL: generatedSQL.sql,
        error: 'Generated SQL execution failed',
        message: sqlError.message
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Generate SQL error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'SQL generation failed',  
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Hive SQL 생성 핸들러 (실행하지 않고 쿼리만 생성)
async function handleGenerateHiveSQL(request, env, corsHeaders) {
  try {
    console.log('Starting handleGenerateHiveSQL...');
    
    const requestBody = await request.json();
    console.log('Request body:', requestBody);
    
    const { userQuery } = requestBody;
    
    if (!userQuery) {
      console.log('Missing userQuery or apiKey');
      return new Response(JSON.stringify({ 
        error: 'User query is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 스키마 정보 가져오기
    console.log('Getting schema info for Hive...');
    const schemaInfo = await getSchemaInfo(env.DB);
    console.log('Schema info:', schemaInfo);
    
    // ChatGPT API로 Hive SQL 생성
    console.log('Calling ChatGPT API for Hive...');
    const generatedSQL = await generateHiveSQLWithChatGPT(userQuery, schemaInfo, env.OPENAI_API_KEY);
    console.log('ChatGPT Hive result:', generatedSQL);
    
    if (!generatedSQL.success) {
      return new Response(JSON.stringify(generatedSQL), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hive SQL은 실행하지 않고 쿼리만 반환
    return new Response(JSON.stringify({
      success: true,
      userQuery,
      generatedHiveSQL: generatedSQL.sql,
      queryType: 'hive',
      note: 'Hive 쿼리가 생성되었습니다. 실제 Hive 클러스터에서 실행해주세요.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Generate Hive SQL error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Hive SQL generation failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Hive SQL 실행 핸들러 (Cloudflare D1에서 시뮬레이션)
async function handleExecuteHiveSQL(request, env, corsHeaders) {
  try {
    console.log('Starting handleExecuteHiveSQL (D1 simulation)...');
    
    const requestBody = await request.json();
    console.log('Request body:', requestBody);
    
    const { userQuery } = requestBody;
    
    if (!userQuery) {
      return new Response(JSON.stringify({ 
        error: 'User query is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 스키마 정보 가져오기
    console.log('Getting schema info for Hive execution...');
    const schemaInfo = await getSchemaInfo(env.DB);
    
    // ChatGPT API로 Hive SQL 생성
    console.log('Calling ChatGPT API for Hive...');
    const generatedSQL = await generateHiveSQLWithChatGPT(userQuery, schemaInfo, env.OPENAI_API_KEY);
    
    if (!generatedSQL.success) {
      return new Response(JSON.stringify(generatedSQL), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hive SQL을 D1에서 실행 (시뮬레이션)
    console.log('Executing Hive SQL on D1 (simulation)...');
    const hiveResult = await executeHiveOnD1(generatedSQL.sql, env.DB);
    
    if (!hiveResult.success) {
      return new Response(JSON.stringify({
        success: false,
        userQuery,
        generatedHiveSQL: generatedSQL.sql,
        error: 'Hive simulation failed',
        message: hiveResult.error
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      userQuery,
      generatedHiveSQL: hiveResult.originalHiveSQL,
      convertedSQLiteSQL: hiveResult.convertedSQLiteSQL,
      data: hiveResult.data,
      meta: hiveResult.meta,
      executionTime: hiveResult.executionTime,
      queryType: 'hive-simulated',
      note: 'Hive SQL이 SQLite로 변환되어 Cloudflare D1에서 실행되었습니다.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Execute Hive SQL (simulation) error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Hive SQL simulation failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Sybase SQL 생성 핸들러 (쿼리만 생성, 실행 안함)
async function handleGenerateSybaseSQL(request, env, corsHeaders) {
  try {
    console.log('Starting handleGenerateSybaseSQL...');
    
    const requestBody = await request.json();
    console.log('Request body:', requestBody);
    
    const { userQuery } = requestBody;
    
    if (!userQuery) {
      console.log('Missing userQuery or apiKey');
      return new Response(JSON.stringify({ 
        error: 'User query is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 스키마 정보 가져오기
    console.log('Getting schema info for Sybase...');
    const schemaInfo = await getSchemaInfo(env.DB);
    console.log('Schema info:', schemaInfo);
    
    // ChatGPT API로 Sybase SQL 생성
    console.log('Calling ChatGPT API for Sybase...');
    const generatedSQL = await generateSybaseSQLWithChatGPT(userQuery, schemaInfo, env.OPENAI_API_KEY);
    console.log('ChatGPT Sybase result:', generatedSQL);
    
    if (!generatedSQL.success) {
      return new Response(JSON.stringify(generatedSQL), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sybase SQL은 실행하지 않고 쿼리만 반환
    return new Response(JSON.stringify({
      success: true,
      userQuery,
      generatedSybaseSQL: generatedSQL.sql,
      queryType: 'sybase',
      note: 'Sybase 쿼리가 생성되었습니다. 실제 Sybase 서버에서 실행해주세요.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Generate Sybase SQL error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Sybase SQL generation failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Sybase SQL 실행 핸들러 (Cloudflare D1에서 시뮬레이션)
async function handleExecuteSybaseSQL(request, env, corsHeaders) {
  try {
    console.log('Starting handleExecuteSybaseSQL (D1 simulation)...');
    
    const requestBody = await request.json();
    console.log('Request body:', requestBody);
    
    const { userQuery } = requestBody;
    
    if (!userQuery) {
      return new Response(JSON.stringify({ 
        error: 'User query is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 스키마 정보 가져오기
    console.log('Getting schema info for Sybase execution...');
    const schemaInfo = await getSchemaInfo(env.DB);
    
    // ChatGPT API로 Sybase SQL 생성
    console.log('Calling ChatGPT API for Sybase...');
    const generatedSQL = await generateSybaseSQLWithChatGPT(userQuery, schemaInfo, env.OPENAI_API_KEY);
    
    if (!generatedSQL.success) {
      return new Response(JSON.stringify(generatedSQL), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sybase SQL을 D1에서 실행 (시뮬레이션)
    console.log('Executing Sybase SQL on D1 (simulation)...');
    const sybaseResult = await executeSybaseOnD1(generatedSQL.sql, env.DB);
    
    if (!sybaseResult.success) {
      return new Response(JSON.stringify({
        success: false,
        userQuery,
        generatedSybaseSQL: generatedSQL.sql,
        error: 'Sybase simulation failed',
        message: sybaseResult.error
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      userQuery,
      generatedSybaseSQL: sybaseResult.originalSybaseSQL,
      convertedSQLiteSQL: sybaseResult.convertedSQLiteSQL,
      data: sybaseResult.data,
      meta: sybaseResult.meta,
      executionTime: sybaseResult.executionTime,
      queryType: 'sybase-simulated',
      note: 'Sybase SQL이 SQLite로 변환되어 Cloudflare D1에서 실행되었습니다.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Execute Sybase SQL (simulation) error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Sybase SQL simulation failed',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Hive SQL을 SQLite 호환 SQL로 변환
function convertHiveToSQLite(hiveSQL) {
  let sqliteSQL = hiveSQL;
  
  try {
    // 1. 주석 제거
    sqliteSQL = sqliteSQL.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 2. Hive 특화 키워드 변환
    sqliteSQL = sqliteSQL.replace(/\bSTRING\b/gi, 'TEXT');
    sqliteSQL = sqliteSQL.replace(/\bBIGINT\b/gi, 'INTEGER');
    sqliteSQL = sqliteSQL.replace(/\bDOUBLE\b/gi, 'REAL');
    
    // 3. Hive 함수를 SQLite 함수로 변환
    // concat(col1, col2) → col1 || col2
    sqliteSQL = sqliteSQL.replace(/concat\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, '($1 || $2)');
    
    // substr() → substr() (동일하지만 확인)
    // length() → length() (동일)
    
    // 4. Hive collect_list() → group_concat()
    sqliteSQL = sqliteSQL.replace(/collect_list\s*\(/gi, 'group_concat(');
    
    // 5. Hive explode() 제거 (SQLite에서 지원 안함)
    sqliteSQL = sqliteSQL.replace(/LATERAL\s+VIEW\s+explode\([^)]+\)\s+\w+\s+AS\s+\w+/gi, '');
    
    // 6. Hive 날짜 함수 변환
    sqliteSQL = sqliteSQL.replace(/from_unixtime\s*\(/gi, 'datetime(');
    sqliteSQL = sqliteSQL.replace(/unix_timestamp\s*\(/gi, 'strftime("%s", ');
    sqliteSQL = sqliteSQL.replace(/year\s*\(/gi, 'strftime("%Y", ');
    sqliteSQL = sqliteSQL.replace(/month\s*\(/gi, 'strftime("%m", ');
    sqliteSQL = sqliteSQL.replace(/day\s*\(/gi, 'strftime("%d", ');
    
    // 7. Hive CASE WHEN 구문 정규화
    // SQLite와 호환되므로 그대로 유지
    
    // 8. 백틱 제거 (Hive에서 사용하는 컬럼 이스케이프)
    sqliteSQL = sqliteSQL.replace(/`/g, '');
    
    // 9. 여분의 공백 정리
    sqliteSQL = sqliteSQL.replace(/\s+/g, ' ').trim();
    
    console.log('Hive to SQLite conversion:', { original: hiveSQL, converted: sqliteSQL });
    
    return {
      success: true,
      convertedSQL: sqliteSQL,
      originalSQL: hiveSQL
    };
    
  } catch (error) {
    console.error('Hive to SQLite conversion error:', error);
    return {
      success: false,
      error: error.message,
      originalSQL: hiveSQL
    };
  }
}

// Sybase SQL을 SQLite 호환 SQL로 변환
function convertSybaseToSQLite(sybaseSQL) {
  let sqliteSQL = sybaseSQL;
  
  try {
    // 1. 주석 제거
    sqliteSQL = sqliteSQL.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 2. Sybase 특화 키워드 변환
    sqliteSQL = sqliteSQL.replace(/\bVARCHAR\b/gi, 'TEXT');
    sqliteSQL = sqliteSQL.replace(/\bCHAR\b/gi, 'TEXT');
    sqliteSQL = sqliteSQL.replace(/\bNVARCHAR\b/gi, 'TEXT');
    sqliteSQL = sqliteSQL.replace(/\bTEXT\b/gi, 'TEXT');
    sqliteSQL = sqliteSQL.replace(/\bIMAGE\b/gi, 'BLOB');
    sqliteSQL = sqliteSQL.replace(/\bBINARY\b/gi, 'BLOB');
    sqliteSQL = sqliteSQL.replace(/\bVARBINARY\b/gi, 'BLOB');
    sqliteSQL = sqliteSQL.replace(/\bSMALLINT\b/gi, 'INTEGER');
    sqliteSQL = sqliteSQL.replace(/\bTINYINT\b/gi, 'INTEGER');
    sqliteSQL = sqliteSQL.replace(/\bBIGINT\b/gi, 'INTEGER');
    sqliteSQL = sqliteSQL.replace(/\bNUMERIC\b/gi, 'REAL');
    sqliteSQL = sqliteSQL.replace(/\bDECIMAL\b/gi, 'REAL');
    sqliteSQL = sqliteSQL.replace(/\bFLOAT\b/gi, 'REAL');
    sqliteSQL = sqliteSQL.replace(/\bREAL\b/gi, 'REAL');
    sqliteSQL = sqliteSQL.replace(/\bDOUBLE\s+PRECISION\b/gi, 'REAL');
    sqliteSQL = sqliteSQL.replace(/\bMONEY\b/gi, 'REAL');
    sqliteSQL = sqliteSQL.replace(/\bSMALLMONEY\b/gi, 'REAL');
    sqliteSQL = sqliteSQL.replace(/\bDATETIME\b/gi, 'TEXT');
    sqliteSQL = sqliteSQL.replace(/\bSMALLDATETIME\b/gi, 'TEXT');
    sqliteSQL = sqliteSQL.replace(/\bDATE\b/gi, 'TEXT');
    sqliteSQL = sqliteSQL.replace(/\bTIME\b/gi, 'TEXT');
    sqliteSQL = sqliteSQL.replace(/\bTIMESTAMP\b/gi, 'TEXT');
    
    // 3. Sybase 함수를 SQLite 함수로 변환
    // ISNULL() → IFNULL()
    sqliteSQL = sqliteSQL.replace(/ISNULL\s*\(/gi, 'IFNULL(');
    
    // GETDATE() → datetime('now')
    sqliteSQL = sqliteSQL.replace(/GETDATE\s*\(\s*\)/gi, "datetime('now')");
    
    // DATEPART() → strftime()
    sqliteSQL = sqliteSQL.replace(/DATEPART\s*\(\s*YEAR\s*,\s*([^)]+)\s*\)/gi, "strftime('%Y', $1)");
    sqliteSQL = sqliteSQL.replace(/DATEPART\s*\(\s*MONTH\s*,\s*([^)]+)\s*\)/gi, "strftime('%m', $1)");
    sqliteSQL = sqliteSQL.replace(/DATEPART\s*\(\s*DAY\s*,\s*([^)]+)\s*\)/gi, "strftime('%d', $1)");
    sqliteSQL = sqliteSQL.replace(/DATEPART\s*\(\s*HOUR\s*,\s*([^)]+)\s*\)/gi, "strftime('%H', $1)");
    sqliteSQL = sqliteSQL.replace(/DATEPART\s*\(\s*MINUTE\s*,\s*([^)]+)\s*\)/gi, "strftime('%M', $1)");
    sqliteSQL = sqliteSQL.replace(/DATEPART\s*\(\s*SECOND\s*,\s*([^)]+)\s*\)/gi, "strftime('%S', $1)");
    
    // SUBSTRING() → substr()
    sqliteSQL = sqliteSQL.replace(/SUBSTRING\s*\(/gi, 'substr(');
    
    // LEN() → length()
    sqliteSQL = sqliteSQL.replace(/LEN\s*\(/gi, 'length(');
    
    // CHARINDEX() → instr() (매개변수 순서 바뀜)
    sqliteSQL = sqliteSQL.replace(/CHARINDEX\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, 'instr($2, $1)');
    
    // LEFT() → substr(string, 1, length)
    sqliteSQL = sqliteSQL.replace(/LEFT\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, 'substr($1, 1, $2)');
    
    // RIGHT() → substr(string, -length)
    sqliteSQL = sqliteSQL.replace(/RIGHT\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, 'substr($1, -$2)');
    
    // STUFF() → replace() 조합으로 변환 (복잡하므로 기본적인 경우만)
    // PATINDEX() → 제거 (SQLite에서 직접 지원 안함)
    sqliteSQL = sqliteSQL.replace(/PATINDEX\s*\([^)]+\)/gi, '0');
    
    // 4. Sybase TOP 구문 → LIMIT
    sqliteSQL = sqliteSQL.replace(/SELECT\s+TOP\s+(\d+)\s+/gi, 'SELECT ');
    sqliteSQL = sqliteSQL.replace(/ORDER\s+BY\s+([^;]+)/gi, 'ORDER BY $1 LIMIT $1');
    
    // 5. Sybase IDENTITY 컬럼 → AUTOINCREMENT
    sqliteSQL = sqliteSQL.replace(/IDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'PRIMARY KEY AUTOINCREMENT');
    
    // 6. Sybase 대소문자 구분 처리
    // SQLite는 기본적으로 대소문자 구분하지 않음
    
    // 7. Sybase GO 구문 제거
    sqliteSQL = sqliteSQL.replace(/^\s*GO\s*$/gm, '');
    
    // 8. 대괄호 제거 (Sybase/SQL Server 스타일)
    sqliteSQL = sqliteSQL.replace(/\[([^\]]+)\]/g, '$1');
    
    // 9. 여분의 공백 정리
    sqliteSQL = sqliteSQL.replace(/\s+/g, ' ').trim();
    
    console.log('Sybase to SQLite conversion:', { original: sybaseSQL, converted: sqliteSQL });
    
    return {
      success: true,
      convertedSQL: sqliteSQL,
      originalSQL: sybaseSQL
    };
    
  } catch (error) {
    console.error('Sybase to SQLite conversion error:', error);
    return {
      success: false,
      error: error.message,
      originalSQL: sybaseSQL
    };
  }
}

// Sybase SQL을 Cloudflare D1에서 실행 (시뮬레이션)
async function executeSybaseOnD1(sybaseSQL, database) {
  try {
    console.log('Converting Sybase SQL to SQLite...');
    const conversion = convertSybaseToSQLite(sybaseSQL);
    
    if (!conversion.success) {
      throw new Error(`SQL 변환 실패: ${conversion.error}`);
    }
    
    console.log('Executing converted SQL on D1...');
    const stmt = database.prepare(conversion.convertedSQL);
    const result = await stmt.all();
    
    return {
      success: true,
      data: result.results,
      meta: result.meta,
      originalSybaseSQL: conversion.originalSQL,
      convertedSQLiteSQL: conversion.convertedSQL,
      executionTime: result.meta?.duration || 0
    };
    
  } catch (error) {
    console.error('Sybase simulation on D1 error:', error);
    return {
      success: false,
      error: error.message,
      originalSybaseSQL: sybaseSQL
    };
  }
}

// Hive SQL을 Cloudflare D1에서 실행 (시뮬레이션)
async function executeHiveOnD1(hiveSQL, database) {
  try {
    console.log('Converting Hive SQL to SQLite...');
    const conversion = convertHiveToSQLite(hiveSQL);
    
    if (!conversion.success) {
      throw new Error(`SQL 변환 실패: ${conversion.error}`);
    }
    
    console.log('Executing converted SQL on D1...');
    const stmt = database.prepare(conversion.convertedSQL);
    const result = await stmt.all();
    
    return {
      success: true,
      data: result.results,
      meta: result.meta,
      originalHiveSQL: conversion.originalSQL,
      convertedSQLiteSQL: conversion.convertedSQL,
      executionTime: result.meta?.duration || 0
    };
    
  } catch (error) {
    console.error('Hive simulation on D1 error:', error);
    return {
      success: false,
      error: error.message,
      originalHiveSQL: hiveSQL
    };
  }
}

// 스키마 정보 조회 핸들러
async function handleGetSchema(request, env, corsHeaders) {
  try {
    const schemaInfo = await getSchemaInfo(env.DB);
    
    return new Response(JSON.stringify({
      success: true,
      schema: schemaInfo
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Schema fetch error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch schema',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// 데이터베이스 스키마 정보 가져오기 (하드코딩으로 변경)
async function getSchemaInfo(db) {
  // D1에서 PRAGMA 명령이 제한적이므로 하드코딩된 스키마 사용
  return {
    employees: {
      columns: [
        { name: 'id', type: 'INTEGER', notNull: true, primaryKey: true },
        { name: 'name', type: 'TEXT', notNull: true, primaryKey: false },
        { name: 'department', type: 'TEXT', notNull: true, primaryKey: false },
        { name: 'salary', type: 'INTEGER', notNull: true, primaryKey: false },
        { name: 'hire_date', type: 'DATE', notNull: true, primaryKey: false }
      ],
      description: '직원 정보 테이블'
    },
    departments: {
      columns: [
        { name: 'id', type: 'INTEGER', notNull: true, primaryKey: true },
        { name: 'name', type: 'TEXT', notNull: true, primaryKey: false },
        { name: 'manager_id', type: 'INTEGER', notNull: false, primaryKey: false },
        { name: 'budget', type: 'INTEGER', notNull: true, primaryKey: false }
      ],
      description: '부서 정보 테이블'
    },
    projects: {
      columns: [
        { name: 'id', type: 'INTEGER', notNull: true, primaryKey: true },
        { name: 'name', type: 'TEXT', notNull: true, primaryKey: false },
        { name: 'start_date', type: 'DATE', notNull: true, primaryKey: false },
        { name: 'end_date', type: 'DATE', notNull: false, primaryKey: false },
        { name: 'budget', type: 'INTEGER', notNull: true, primaryKey: false }
      ],
      description: '프로젝트 정보 테이블'
    },
    employee_projects: {
      columns: [
        { name: 'employee_id', type: 'INTEGER', notNull: true, primaryKey: true },
        { name: 'project_id', type: 'INTEGER', notNull: true, primaryKey: true },
        { name: 'role', type: 'TEXT', notNull: false, primaryKey: false }
      ],
      description: '직원-프로젝트 관계 테이블'
    }
  };
}

// 테이블 설명 반환
function getTableDescription(tableName) {
  const descriptions = {
    'employees': '직원 정보 테이블',
    'departments': '부서 정보 테이블',
    'projects': '프로젝트 정보 테이블',
    'employee_projects': '직원-프로젝트 관계 테이블'
  };
  return descriptions[tableName] || `${tableName} 테이블`;
}

// 고급 규칙 기반 SQL 생성 (OpenAI API 대체)
async function generateSQLWithRules(userQuery, schemaInfo) {
  try {
    const query = userQuery.toLowerCase();
    console.log('Using rule-based SQL generation for:', userQuery);
    
    // 고급 한국어 자연어 처리
    let sql = '';
    
    // 1. 특정 이름 검색 (개선된 패턴 - 더 엄격함)
    const namePatterns = [
      /['"]([가-힣]{2,4})['"]/,  // 따옴표로 감싸진 이름
      /([가-힣]{2,4})(?:의|이|가|을|를|에게|한테)\s*(?:급여|정보|연봉|데이터)/,  // 조사가 붙은 이름 + 정보 요청
      /([가-힣]{2,4})\s*(?:직원|사원|님)(?:의|이|가|을|를)/,  // 직원, 사원이 붙은 이름
    ];
    
    let targetName = null;
    
    // 일반적인 단어들은 이름으로 인식하지 않음
    const excludedWords = ['급여', '정보', '연봉', '부서', '직원', '사원', '평균', '최고', '가장', '높은', '낮은'];
    
    for (const pattern of namePatterns) {
      const match = userQuery.match(pattern);
      if (match && !excludedWords.includes(match[1])) {
        targetName = match[1];
        break;
      }
    }
    
    if (targetName && (query.includes('급여') || query.includes('정보') || query.includes('연봉') || query.includes('salary') || query.includes('info'))) {
      sql = `SELECT name, department, salary, hire_date FROM employees WHERE name = '${targetName}';`;
    }
    // 2. 급여 관련 쿼리 (한국어 + 영어)
    else if ((query.includes('급여') && (query.includes('높은') || query.includes('많은') || query.includes('최고') || query.includes('가장'))) ||
             (query.includes('salary') && (query.includes('high') || query.includes('highest') || query.includes('max') || query.includes('top')))) {
      sql = 'SELECT name, department, salary FROM employees ORDER BY salary DESC LIMIT 5;';
    }
    else if ((query.includes('급여') && (query.includes('낮은') || query.includes('적은') || query.includes('최소'))) ||
             (query.includes('salary') && (query.includes('low') || query.includes('lowest') || query.includes('min')))) {
      sql = 'SELECT name, department, salary FROM employees ORDER BY salary ASC LIMIT 5;';
    }
    else if ((query.includes('평균') && query.includes('급여')) || (query.includes('average') && query.includes('salary'))) {
      if (query.includes('부서') || query.includes('department')) {
        sql = 'SELECT department, AVG(salary) AS avg_salary FROM employees GROUP BY department;';
      } else {
        sql = 'SELECT AVG(salary) AS avg_salary FROM employees;';
      }
    }
    // 3. 부서 관련 쿼리
    else if (query.includes('개발팀') || query.includes('개발')) {
      sql = "SELECT name, salary, hire_date FROM employees WHERE department = '개발팀';";
    }
    else if (query.includes('부서') && query.includes('직원')) {
      sql = 'SELECT department, COUNT(*) AS employee_count FROM employees GROUP BY department;';
    }
    // 4. 입사 관련 쿼리
    else if (query.includes('2023') && query.includes('입사')) {
      sql = "SELECT name, department, hire_date FROM employees WHERE hire_date >= '2023-01-01' AND hire_date <= '2023-12-31';";
    }
    else if (query.includes('최근') && query.includes('입사')) {
      sql = 'SELECT name, department, hire_date FROM employees ORDER BY hire_date DESC LIMIT 5;';
    }
    // 5. 프로젝트 관련 쿼리
    else if (query.includes('프로젝트')) {
      if (query.includes('진행') || query.includes('현재')) {
        sql = 'SELECT * FROM projects WHERE end_date IS NULL;';
      } else if (query.includes('예산') || query.includes('비용')) {
        sql = 'SELECT name, budget FROM projects ORDER BY budget DESC;';
      } else {
        sql = 'SELECT * FROM projects;';
      }
    }
    // 6. 특정 급여 범위 (더 자세한 패턴)
    else if (query.includes('5000만') || query.includes('50000000') || query.includes('5천만')) {
      if (query.includes('이상') || query.includes('넘는') || query.includes('over')) {
        sql = 'SELECT name, department, salary FROM employees WHERE salary >= 50000000;';
      } else if (query.includes('이하') || query.includes('미만') || query.includes('under')) {
        sql = 'SELECT name, department, salary FROM employees WHERE salary <= 50000000;';
      } else {
        sql = 'SELECT name, department, salary FROM employees WHERE salary >= 50000000;';
      }
    }
    // 7. 기본 직원 목록
    else {
      sql = 'SELECT name, department, salary FROM employees LIMIT 10;';
    }
    
    console.log('Generated SQL:', sql);
    
    return {
      success: true,
      sql: sql
    };
    
  } catch (error) {
    console.error('Rule-based SQL generation error:', error);
    return {
      success: false,
      error: 'Failed to generate SQL with rules',
      message: error.message
    };
  }
}

// AI API로 SQL 생성 (Ollama 로컬 모델 사용)
async function generateSQLWithAI(userQuery, schemaInfo, apiKey) {
  try {
    console.log('🤖 Using Ollama local AI for SQL generation...');
    return await callLocalTransformerModel(userQuery, schemaInfo);
  } catch (error) {
    console.error('Ollama AI error:', error);
    console.log('Falling back to rule-based SQL generation');
    return await generateSQLWithRules(userQuery, schemaInfo);
  }
}


// Ollama 로컬 모델 호출 함수
async function callLocalTransformerModel(userQuery, schemaInfo) {
  try {
    console.log('🤖 Calling Ollama ttsql-model for text-to-SQL generation...');

    // ttsql-model은 이미 DB 스키마를 알고 있으므로 사용자 질문만 전달
    // Ollama API 호출
    try {
      const localResponse = await fetch('http://localhost:11434/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'ttsql-model',
          messages: [
            {
              role: 'user',
              content: userQuery // 커스텀 모델은 이미 스키마를 알고 있으므로 바로 질문만 전달
            }
          ],
          max_tokens: 200,
          temperature: 0.1
        })
      });

      if (localResponse.ok) {
        const localData = await localResponse.json();
        const sql = localData.choices[0]?.message?.content?.trim();

        if (sql && sql.toLowerCase().includes('select')) {
          console.log('✅ Ollama API success:', sql);
          return {
            success: true,
            sql: sql,
            source: 'ollama'
          };
        }
      }
    } catch (localError) {
      console.log('❌ Ollama API failed:', localError.message);
      // Ollama 실패시 고급 규칙 기반으로 폴백
      console.log('🎯 Using advanced rule-based SQL generation...');
      const sqlResult = await generatePreciseSQL(userQuery, schemaInfo);

      if (sqlResult.success) {
        console.log('✅ Rule-based generated SQL:', sqlResult.sql);
        return {
          success: true,
          sql: sqlResult.sql,
          source: 'rule_based'
        };
      }
    }

    return { success: false, error: 'Ollama and rule-based generation failed' };

  } catch (error) {
    console.error('AI model call error:', error);
    return { success: false, error: error.message };
  }
}

// 정교한 AI 기반 SQL 생성 함수
async function generatePreciseSQL(userQuery, schemaInfo) {
  try {
    console.log('🎯 Analyzing query with AI precision:', userQuery);
    
    const query = userQuery.toLowerCase();
    
    // 급여 범위 쿼리 정확한 처리 (모든 패턴 지원)
    if (query.includes('급여') && query.includes('사이')) {
      // 다양한 급여 범위 패턴들 (모든 조합 지원)
      const patterns = [
        /(\d+)\s*천\s*(\d+)\s*백만원\s*에서\s*(\d+)\s*천\s*(\d+)\s*백만원\s*사이/,    // 5천 5백만원에서 6천 5백만원 사이
        /(\d+)천\s*(\d+)백만원\s*에서\s*(\d+)천\s*(\d+)백만원\s*사이/,             // 5천5백만원에서 6천5백만원 사이
        /(\d+)\s*천\s*(\d+)\s*백만원\s*에서\s*(\d+)\s*천\s*백만원\s*사이/,          // 5천 5백만원에서 6천 백만원 사이
        /(\d+)천\s*(\d+)백만원\s*에서\s*(\d+)천\s*백만원\s*사이/,                 // 5천5백만원에서 6천백만원 사이
        /(\d+)\s*천\s*백만원\s*에서\s*(\d+)\s*천\s*(\d+)\s*백만원\s*사이/,          // 5천 백만원에서 6천 5백만원 사이
        /(\d+)\s*천\s*(\d+)\s*백만원\s*에서\s*(\d+)천만원\s*사이/,                // 5천 5백만원에서 6천만원 사이
        /(\d+)천\s*(\d+)백만원\s*에서\s*(\d+)천만원\s*사이/,                     // 5천5백만원에서 6천만원 사이
        /(\d+)천만원\s*에서\s*(\d+)\s*천\s*(\d+)\s*백만원\s*사이/,                // 5천만원에서 6천 5백만원 사이
        /(\d+)천만원\s*에서\s*(\d+)\s*천\s*백만원\s*사이/,                        // 5천만원에서 6천 백만원 사이
        /(\d+)천만원\s*에서\s*(\d+)천만원\s*사이/,                               // 5천만원에서 6천만원 사이
        /(\d+)\s*천만원\s*에서\s*(\d+)\s*천만원\s*사이/                          // 공백 있는 버전
      ];
      
      // 패턴별 처리
      for (let i = 0; i < patterns.length; i++) {
        const match = query.match(patterns[i]);
        if (match) {
          let minAmount, maxAmount;
          
          // 패턴별 처리 (새로운 패턴 포함)
          if (i === 0 || i === 1) {
            // 패턴 0, 1: 양쪽 모두 천+N백만원 (5천 5백만원에서 6천 5백만원 사이)
            minAmount = (parseInt(match[1]) * 10000000) + (parseInt(match[2]) * 1000000);
            maxAmount = (parseInt(match[3]) * 10000000) + (parseInt(match[4]) * 1000000);
            console.log(`Full range: ${match[1]}천${match[2]}백만원(${minAmount}) ~ ${match[3]}천${match[4]}백만원(${maxAmount})`);
          }
          else if (i === 2 || i === 3) {
            // 패턴 2, 3: 시작은 천+N백만원, 끝은 천+백만원 (5천 5백만원에서 6천 백만원 사이)
            minAmount = (parseInt(match[1]) * 10000000) + (parseInt(match[2]) * 1000000);
            maxAmount = (parseInt(match[3]) * 10000000) + 1000000; // 천 백만원 = N천 + 1백만원
            console.log(`Complex range: ${match[1]}천${match[2]}백만원(${minAmount}) ~ ${match[3]}천백만원(${maxAmount})`);
          }
          else if (i === 4) {
            // 패턴 4: 시작은 천+백만원, 끝은 천+N백만원 (5천 백만원에서 6천 5백만원 사이)
            minAmount = (parseInt(match[1]) * 10000000) + 1000000; // 천 백만원
            maxAmount = (parseInt(match[2]) * 10000000) + (parseInt(match[3]) * 1000000);
            console.log(`Reverse complex: ${match[1]}천백만원(${minAmount}) ~ ${match[2]}천${match[3]}백만원(${maxAmount})`);
          }
          else if (i === 5 || i === 6) {
            // 패턴 5, 6: 시작은 천+N백만원, 끝은 천만원 (5천 5백만원에서 6천만원 사이)
            minAmount = (parseInt(match[1]) * 10000000) + (parseInt(match[2]) * 1000000);
            maxAmount = parseInt(match[3]) * 10000000;
            console.log(`Mixed range: ${match[1]}천${match[2]}백만원(${minAmount}) ~ ${match[3]}천만원(${maxAmount})`);
          }
          else if (i === 7) {
            // 패턴 7: 시작은 천만원, 끝은 천+N백만원 (5천만원에서 6천 5백만원 사이)
            minAmount = parseInt(match[1]) * 10000000;
            maxAmount = (parseInt(match[2]) * 10000000) + (parseInt(match[3]) * 1000000);
            console.log(`Reverse mixed: ${match[1]}천만원(${minAmount}) ~ ${match[2]}천${match[3]}백만원(${maxAmount})`);
          }
          else if (i === 8) {
            // 패턴 8: 시작은 천만원, 끝은 천+백만원 (5천만원에서 6천 백만원 사이)
            minAmount = parseInt(match[1]) * 10000000;
            maxAmount = (parseInt(match[2]) * 10000000) + 1000000; // 천 백만원
            console.log(`Special range: ${match[1]}천만원(${minAmount}) ~ ${match[2]}천백만원(${maxAmount})`);
          }
          else {
            // 패턴 9, 10: 기본 천만원 (5천만원에서 6천만원 사이)
            minAmount = parseInt(match[1]) * 10000000;
            maxAmount = parseInt(match[2]) * 10000000;
            console.log(`Basic range: ${match[1]}천만원(${minAmount}) ~ ${match[2]}천만원(${maxAmount})`);
          }
          
          return {
            success: true,
            sql: `SELECT name, department, salary FROM employees WHERE salary BETWEEN ${minAmount} AND ${maxAmount};`
          };
        }
      }
    }
    
    // 급여 비교 쿼리
    if (query.includes('급여') && (query.includes('높은') || query.includes('많은') || query.includes('최고'))) {
      return {
        success: true,
        sql: 'SELECT name, department, salary FROM employees ORDER BY salary DESC LIMIT 5;'
      };
    }
    
    // 부서별 평균
    if (query.includes('부서') && query.includes('평균') && query.includes('급여')) {
      return {
        success: true,
        sql: 'SELECT department, AVG(salary) AS avg_salary FROM employees GROUP BY department;'
      };
    }
    
    // 특정 부서 직원
    if (query.includes('개발팀')) {
      return {
        success: true,
        sql: "SELECT name, department, salary FROM employees WHERE department = '개발팀';"
      };
    }
    
    // 입사년도 쿼리
    const yearMatch = query.match(/(\d{4})년?/);
    if (yearMatch && query.includes('입사')) {
      const year = yearMatch[1];
      return {
        success: true,
        sql: `SELECT name, department, hire_date FROM employees WHERE hire_date >= '${year}-01-01' AND hire_date <= '${year}-12-31';`
      };
    }
    
    // 기본 직원 목록
    return {
      success: true,
      sql: 'SELECT name, department, salary FROM employees LIMIT 10;'
    };
    
  } catch (error) {
    console.error('Precise SQL generation error:', error);
    return { success: false, error: error.message };
  }
}

// 쿼리 컨텍스트 분석
function analyzeQueryContext(userQuery) {
  const query = userQuery.toLowerCase();
  
  return {
    isQuestion: query.includes('?') || query.includes('누구') || query.includes('무엇') || query.includes('언제') || query.includes('얼마') || query.includes('몇') || query.includes('who') || query.includes('what') || query.includes('when') || query.includes('how'),
    isComparison: query.includes('높은') || query.includes('낮은') || query.includes('많은') || query.includes('적은') || query.includes('최고') || query.includes('최저') || query.includes('가장') || query.includes('highest') || query.includes('lowest') || query.includes('maximum') || query.includes('minimum') || query.includes('top') || query.includes('best'),
    isCount: query.includes('몇') || query.includes('수') || query.includes('개수') || query.includes('count') || query.includes('how many'),
    isAverage: query.includes('평균') || query.includes('average') || query.includes('avg'),
    isSum: query.includes('합계') || query.includes('총') || query.includes('sum') || query.includes('total'),
    isGrouping: query.includes('부서별') || query.includes('별로') || query.includes('group') || query.includes('by department') || query.includes('per department'),
    isOrdering: query.includes('순으로') || query.includes('정렬') || query.includes('order') || query.includes('sort'),
    isLimit: query.includes('상위') || query.includes('하위') || query.includes('명') || query.includes('개') || query.includes('top') || query.includes('first') || query.includes('one')
  };
}

// 엔티티 추출
function extractEntities(userQuery, schemaInfo) {
  const query = userQuery.toLowerCase();
  
  // 의도 파악
  let intent = 'SELECT';
  if (query.includes('몇') || query.includes('수') || query.includes('개수') || query.includes('count') || query.includes('how many')) {
    intent = 'COUNT';
  } else if (query.includes('평균') || query.includes('합계') || query.includes('총') || query.includes('average') || query.includes('sum') || query.includes('total')) {
    intent = 'AGGREGATE';
  }
  
  // 테이블 결정 (주로 employees 테이블)
  let table = 'employees';
  if (query.includes('프로젝트') || query.includes('project')) {
    table = 'projects';
  } else if (query.includes('부서') && !query.includes('직원')) {
    table = 'departments';
  }
  
  // 컬럼 추출
  const columns = [];
  if (query.includes('이름') || query.includes('name')) columns.push('name');
  if (query.includes('부서') || query.includes('department')) columns.push('department');
  if (query.includes('급여') || query.includes('salary')) columns.push('salary');
  if (query.includes('입사') || query.includes('hire')) columns.push('hire_date');
  if (query.includes('예산') || query.includes('budget')) columns.push('budget');
  
  // 기본 컬럼이 없으면 추가
  if (columns.length === 0 && table === 'employees') {
    columns.push('name', 'department', 'salary');
  }
  
  // 조건 추출
  const conditions = [];
  
  // 부서 조건
  if (query.includes('개발팀') || query.includes('development')) {
    conditions.push(`department = '개발팀'`);
  } else if (query.includes('마케팅팀') || query.includes('marketing')) {
    conditions.push(`department = '마케팅팀'`);
  } else if (query.includes('영업팀') || query.includes('sales')) {
    conditions.push(`department = '영업팀'`);
  } else if (query.includes('인사팀') || query.includes('hr') || query.includes('human')) {
    conditions.push(`department = '인사팀'`);
  }
  
  // 급여 조건 (범위 및 단일 조건 처리)
  
  // 급여 범위 조건 처리 (한국어 + 영어)
  let rangeMatched = false;
  
  // 1. 한국어 범위 패턴 (더 단순하고 강력한 패턴)
  const koreanRangePatterns = [
    /(\d+)천만원\s*에서\s*(\d+)천만원\s*사이/,
    /(\d+)천만원\s*부터\s*(\d+)천만원\s*까지/,
    /(\d+)천만원\s*~\s*(\d+)천만원/,
    /(\d+)천만원\s*-\s*(\d+)천만원/
  ];
  
  for (const pattern of koreanRangePatterns) {
    const match = query.match(pattern);
    if (match) {
      const minAmount = parseInt(match[1]) * 10000000;
      const maxAmount = parseInt(match[2]) * 10000000;
      conditions.push(`salary >= ${minAmount} AND salary <= ${maxAmount}`);
      rangeMatched = true;
      break;
    }
  }
  
  // 2. 영어 범위 패턴
  if (!rangeMatched && query.includes('between') && query.includes('million')) {
    const englishRangeMatch = query.match(/between\s+(\d+)\s+million\s+and\s+(\d+)\s+million/);
    if (englishRangeMatch) {
      const minAmount = parseInt(englishRangeMatch[1]) * 1000000;
      const maxAmount = parseInt(englishRangeMatch[2]) * 1000000;
      conditions.push(`salary >= ${minAmount} AND salary <= ${maxAmount}`);
      rangeMatched = true;
    }
  }
  
  // 3. 단일 급여 조건 (범위가 아닌 경우만)
  if (!rangeMatched) {
    const salaryMatch = query.match(/(\d+)만원?|(\d+)천만원?/);
    if (salaryMatch) {
      const amount = salaryMatch[1] ? parseInt(salaryMatch[1]) * 10000 : parseInt(salaryMatch[2]) * 10000000;
      if (query.includes('이상') || query.includes('넘는') || query.includes('over')) {
        conditions.push(`salary >= ${amount}`);
      } else if (query.includes('이하') || query.includes('미만') || query.includes('under')) {
        conditions.push(`salary <= ${amount}`);
      }
    }
  }
  
  // 년도 조건
  const yearMatch = query.match(/(\d{4})년?/);
  if (yearMatch) {
    const year = yearMatch[1];
    if (query.includes('입사')) {
      conditions.push(`hire_date >= '${year}-01-01' AND hire_date <= '${year}-12-31'`);
    }
  }
  
  // 정렬 방향
  let orderBy = '';
  if (query.includes('높은') || query.includes('많은') || query.includes('최고') || query.includes('desc') || query.includes('highest') || query.includes('maximum') || query.includes('top') || query.includes('best')) {
    orderBy = 'DESC';
  } else if (query.includes('낮은') || query.includes('적은') || query.includes('최저') || query.includes('asc') || query.includes('lowest') || query.includes('minimum') || query.includes('worst')) {
    orderBy = 'ASC';
  }
  
  // 제한
  let limit = '';
  const limitMatch = query.match(/(\d+)명|상위\s*(\d+)|top\s*(\d+)|first\s*(\d+)/);
  if (limitMatch) {
    limit = limitMatch[1] || limitMatch[2] || limitMatch[3] || limitMatch[4];
  } else if (query.includes('가장') || query.includes('최고') || query.includes('최저') || query.includes('the employee') || query.includes('the person') || query.includes('one employee')) {
    limit = '1';
  } else if (intent === 'SELECT' && orderBy) {
    limit = '5'; // 기본 5개
  }
  
  return {
    intent,
    table,
    columns,
    conditions,
    orderBy,
    limit
  };
}

// SELECT 쿼리 생성
function buildSelectQuery(entities, context) {
  let sql = `SELECT ${entities.columns.join(', ')} FROM ${entities.table}`;
  
  if (entities.conditions.length > 0) {
    sql += ` WHERE ${entities.conditions.join(' AND ')}`;
  }
  
  if (entities.orderBy && entities.columns.includes('salary')) {
    sql += ` ORDER BY salary ${entities.orderBy}`;
  }
  
  if (entities.limit) {
    sql += ` LIMIT ${entities.limit}`;
  }
  
  return sql + ';';
}

// COUNT 쿼리 생성
function buildCountQuery(entities, context) {
  let sql = `SELECT COUNT(*) as count FROM ${entities.table}`;
  
  if (entities.conditions.length > 0) {
    sql += ` WHERE ${entities.conditions.join(' AND ')}`;
  }
  
  return sql + ';';
}

// 집계 쿼리 생성
function buildAggregateQuery(entities, context) {
  let aggregateFunc = 'AVG';
  if (context.isSum) aggregateFunc = 'SUM';
  
  let sql = '';
  if (context.isGrouping) {
    sql = `SELECT department, ${aggregateFunc}(salary) AS avg_salary FROM employees GROUP BY department`;
  } else {
    sql = `SELECT ${aggregateFunc}(salary) AS avg_salary FROM employees`;
  }
  
  return sql + ';';
}

// 기본 쿼리 생성
function buildDefaultQuery(entities, context) {
  return `SELECT name, department, salary FROM employees LIMIT 10;`;
}

// SQL 최적화
function optimizeSQL(sql) {
  // 중복 공백 제거
  sql = sql.replace(/\s+/g, ' ').trim();
  
  // 세미콜론 정리
  if (!sql.endsWith(';')) sql += ';';
  
  return sql;
}

// Hive SQL 생성 (규칙 기반 폴백)
async function generateHiveSQLWithChatGPT(userQuery, schemaInfo, apiKey) {
  try {
    console.log('Hive SQL generation using rule-based approach');
    // 기본적인 SQLite 쿼리를 생성하고 Hive 문법으로 간단히 변환
    const sqliteResult = await generateSQLWithRules(userQuery, schemaInfo);

    if (sqliteResult.success) {
      return {
        success: true,
        sql: sqliteResult.sql // Hive도 대부분 표준 SQL과 유사
      };
    }

    return {
      success: false,
      error: 'Failed to generate Hive SQL'
    };
  } catch (error) {
    console.error('Hive SQL generation error:', error);
    return {
      success: false,
      error: 'Failed to generate Hive SQL',
      message: error.message
    };
  }
}

// Sybase SQL 생성 (규칙 기반 폴백)
async function generateSybaseSQLWithChatGPT(userQuery, schemaInfo, apiKey) {
  try {
    console.log('Sybase SQL generation using rule-based approach');
    // 기본적인 SQLite 쿼리를 생성하고 Sybase 문법으로 간단히 변환
    const sqliteResult = await generateSQLWithRules(userQuery, schemaInfo);

    if (sqliteResult.success) {
      return {
        success: true,
        sql: sqliteResult.sql // Sybase도 대부분 표준 SQL과 유사
      };
    }

    return {
      success: false,
      error: 'Failed to generate Sybase SQL'
    };
  } catch (error) {
    console.error('Sybase SQL generation error:', error);
    return {
      success: false,
      error: 'Failed to generate Sybase SQL',
      message: error.message
    };
  }
}

// 스키마 정보를 프롬프트용 텍스트로 변환
function formatSchemaForPrompt(schemaInfo) {
  let schemaText = "다음은 사용 가능한 데이터베이스 테이블들입니다:\n\n";
  
  for (const [tableName, tableInfo] of Object.entries(schemaInfo)) {
    schemaText += `테이블: ${tableName}\n`;
    schemaText += `설명: ${tableInfo.description}\n`;
    schemaText += `컬럼: ${tableInfo.columns.map(col => col.name).join(', ')}\n\n`;
  }
  
  return schemaText;
}

// 디버깅용 핸들러 (Ollama 상태 확인)
async function handleDebugChatGPT(request, env, corsHeaders) {
  try {
    // Ollama 상태 확인
    const testResponse = await fetch('http://localhost:11434/api/tags', {
      method: 'GET'
    });

    if (testResponse.ok) {
      const models = await testResponse.json();
      return new Response(JSON.stringify({
        success: true,
        debug: {
          ollamaStatus: 'running',
          models: models
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Ollama not responding');

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      debug: {
        ollamaStatus: 'not running or not accessible'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}