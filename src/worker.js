// Cloudflare Workers API for TTSQL

export default {
  async fetch(request, env, ctx) {
    // CORS 헤더 설정
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // OPTIONS 요청 처리 (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers: corsHeaders 
      });
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

// SQL 실행 핸들러
async function handleExecuteSQL(request, env, corsHeaders) {
  try {
    const { sql } = await request.json();
    
    if (!sql) {
      return new Response(JSON.stringify({ error: 'SQL query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // D1 데이터베이스에서 SQL 실행
    const stmt = env.DB.prepare(sql);
    const result = await stmt.all();

    return new Response(JSON.stringify({
      success: true,
      data: result.results,
      meta: result.meta
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('SQL execution error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'SQL execution failed',
      message: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ChatGPT를 통한 SQL 생성 + 실행 핸들러
async function handleGenerateSQL(request, env, corsHeaders) {
  try {
    console.log('Starting handleGenerateSQL...');
    
    const requestBody = await request.json();
    console.log('Request body:', requestBody);
    
    const { userQuery, apiKey } = requestBody;
    
    if (!userQuery || !apiKey) {
      console.log('Missing userQuery or apiKey');
      return new Response(JSON.stringify({ 
        error: 'User query and API key are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 스키마 정보 가져오기
    console.log('Getting schema info...');
    const schemaInfo = await getSchemaInfo(env.DB);
    console.log('Schema info:', schemaInfo);
    
    // ChatGPT API로 SQL 생성
    console.log('Calling ChatGPT API...');
    const generatedSQL = await generateSQLWithChatGPT(userQuery, schemaInfo, apiKey);
    console.log('ChatGPT result:', generatedSQL);
    
    if (!generatedSQL.success) {
      return new Response(JSON.stringify(generatedSQL), {
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
    
    const { userQuery, apiKey } = requestBody;
    
    if (!userQuery || !apiKey) {
      console.log('Missing userQuery or apiKey');
      return new Response(JSON.stringify({ 
        error: 'User query and API key are required' 
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
    const generatedSQL = await generateHiveSQLWithChatGPT(userQuery, schemaInfo, apiKey);
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
    
    const { userQuery, apiKey } = requestBody;
    
    if (!userQuery || !apiKey) {
      return new Response(JSON.stringify({ 
        error: 'User query and API key are required' 
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
    const generatedSQL = await generateHiveSQLWithChatGPT(userQuery, schemaInfo, apiKey);
    
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
    
    const { userQuery, apiKey } = requestBody;
    
    if (!userQuery || !apiKey) {
      console.log('Missing userQuery or apiKey');
      return new Response(JSON.stringify({ 
        error: 'User query and API key are required' 
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
    const generatedSQL = await generateSybaseSQLWithChatGPT(userQuery, schemaInfo, apiKey);
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
    
    const { userQuery, apiKey } = requestBody;
    
    if (!userQuery || !apiKey) {
      return new Response(JSON.stringify({ 
        error: 'User query and API key are required' 
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
    const generatedSQL = await generateSybaseSQLWithChatGPT(userQuery, schemaInfo, apiKey);
    
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

// ChatGPT API로 SQL 생성
async function generateSQLWithChatGPT(userQuery, schemaInfo, apiKey) {
  try {
    const schemaText = formatSchemaForPrompt(schemaInfo);
    
    const prompt = `당신은 자연어를 SQL 쿼리로 변환하는 전문가입니다.

${schemaText}

중요한 정보:
- 급여(salary)는 정수형이며 단위는 원입니다. 예: 50000000 (5천만원)
- 예산(budget)도 정수형이며 단위는 원입니다.
- 날짜는 'YYYY-MM-DD' 형식입니다.

규칙:
1. 사용자의 자연어 질문을 정확한 SQL 쿼리로 변환하세요
2. 오직 SQL 쿼리만 응답하세요 (설명이나 다른 텍스트 없음)
3. 위에 제공된 테이블과 컬럼만 사용하세요
4. SQLite 문법을 사용하세요
5. 한국어 질문에 대해 적절한 SQL을 생성하세요
6. 금액 단위에 주의하세요 (5천만원 = 50000000)

사용자 질문: ${userQuery}

SQL:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const sql = data.choices[0].message.content.trim();
    
    return {
      success: true,
      sql: sql
    };

  } catch (error) {
    console.error('ChatGPT API error:', error);
    return {
      success: false,
      error: 'Failed to generate SQL',
      message: error.message
    };
  }
}

// ChatGPT API로 Hive SQL 생성
async function generateHiveSQLWithChatGPT(userQuery, schemaInfo, apiKey) {
  try {
    const schemaText = formatSchemaForPrompt(schemaInfo);
    
    const prompt = `당신은 자연어를 Hive SQL 쿼리로 변환하는 전문가입니다.

${schemaText}

중요한 정보:
- 급여(salary)는 정수형이며 단위는 원입니다. 예: 50000000 (5천만원)
- 예산(budget)도 정수형이며 단위는 원입니다.
- 날짜는 'YYYY-MM-DD' 형식입니다.

Hive SQL 규칙:
1. 사용자의 자연어 질문을 정확한 Hive SQL 쿼리로 변환하세요
2. 오직 Hive SQL 쿼리만 응답하세요 (설명이나 다른 텍스트 없음)
3. 위에 제공된 테이블과 컬럼만 사용하세요
4. Hive SQL 문법을 사용하세요 (HiveQL)
5. 한국어 질문에 대해 적절한 Hive SQL을 생성하세요
6. 금액 단위에 주의하세요 (5천만원 = 50000000)
7. Hive 특화 기능 사용 가능: LATERAL VIEW, explode(), collect_list() 등
8. 파티션이 있다면 WHERE 절에 파티션 필터를 포함하세요
9. 대용량 데이터 처리를 고려한 효율적인 쿼리를 생성하세요

사용자 질문: ${userQuery}

Hive SQL:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const sql = data.choices[0].message.content.trim();
    
    return {
      success: true,
      sql: sql
    };

  } catch (error) {
    console.error('ChatGPT Hive API error:', error);
    return {
      success: false,
      error: 'Failed to generate Hive SQL',
      message: error.message
    };
  }
}

// ChatGPT API로 Sybase SQL 생성
async function generateSybaseSQLWithChatGPT(userQuery, schemaInfo, apiKey) {
  try {
    const schemaText = formatSchemaForPrompt(schemaInfo);
    
    const prompt = `당신은 자연어를 Sybase SQL 쿼리로 변환하는 전문가입니다.

${schemaText}

중요한 정보:
- 급여(salary)는 정수형이며 단위는 원입니다. 예: 50000000 (5천만원)
- 예산(budget)도 정수형이며 단위는 원입니다.
- 날짜는 'YYYY-MM-DD' 형식입니다.

Sybase SQL 규칙:
1. 사용자의 자연어 질문을 정확한 Sybase SQL 쿼리로 변환하세요
2. 오직 Sybase SQL 쿼리만 응답하세요 (설명이나 다른 텍스트 없음)
3. 위에 제공된 테이블과 컬럼만 사용하세요
4. Sybase ASE/IQ 문법을 사용하세요
5. 한국어 질문에 대해 적절한 Sybase SQL을 생성하세요
6. 금액 단위에 주의하세요 (5천만원 = 50000000)
7. Sybase 특화 기능 사용 가능: ISNULL(), GETDATE(), DATEPART(), SUBSTRING(), LEN() 등
8. TOP N 구문을 사용할 수 있습니다 (SELECT TOP 10 ...)
9. 대소문자 구분에 주의하세요
10. 문자열 함수: LEFT(), RIGHT(), CHARINDEX(), PATINDEX() 사용 가능

사용자 질문: ${userQuery}

Sybase SQL:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const sql = data.choices[0].message.content.trim();
    
    return {
      success: true,
      sql: sql
    };

  } catch (error) {
    console.error('ChatGPT Sybase API error:', error);
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