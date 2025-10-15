// ChatGPT API 연동 함수들

class TTSQLAPI {
    constructor() {
        this.workerUrl = CONFIG.WORKER_URL || ''; // 상대 경로 사용
    }

    // 스키마 정보를 문자열로 변환
    getSchemaPrompt() {
        let schemaText = "다음은 사용 가능한 데이터베이스 테이블들입니다:\n\n";
        
        for (const [tableName, tableInfo] of Object.entries(CONFIG.DB_SCHEMA)) {
            schemaText += `테이블: ${tableName}\n`;
            schemaText += `설명: ${tableInfo.description}\n`;
            schemaText += `컬럼: ${tableInfo.columns.join(', ')}\n\n`;
        }
        
        return schemaText;
    }

    // 자연어를 SQL로 변환하는 프롬프트 생성
    createSQLPrompt(userQuery) {
        const systemPrompt = `당신은 자연어를 SQL 쿼리로 변환하는 전문가입니다.

${this.getSchemaPrompt()}

규칙:
1. 사용자의 자연어 질문을 정확한 SQL 쿼리로 변환하세요
2. 오직 SQL 쿼리만 응답하세요 (설명이나 다른 텍스트 없음)
3. 위에 제공된 테이블과 컬럼만 사용하세요
4. PostgreSQL 문법을 사용하세요
5. 한국어 질문에 대해 적절한 SQL을 생성하세요

사용자 질문: ${userQuery}

SQL:`;

        return systemPrompt;
    }

    // Workers API 연결 테스트
    async testConnection() {
        try {
            console.log('🔍 Workers API 연결 확인 중...');
            const response = await fetch(`${this.workerUrl}/api/test`, {
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Workers API 연결 성공');
            return data;

        } catch (error) {
            console.warn('⚠️ Workers API 연결 실패 - 폴백 모드로 진행됩니다');
            throw error;
        }
    }

    // 이 함수들은 보안상 제거되었습니다. 모든 SQL 생성은 Workers를 통해서만 처리됩니다.

    // Workers API를 통한 SQL 생성 및 실행 (새로운 방법)
    async generateAndExecuteSQL(userQuery) {
        console.log('🚀 Workers API를 통한 SQL 생성 및 실행');
        
        try {
            // 같은 서버의 API 사용
            let response;

            try {
                response = await fetch(`${this.workerUrl}/api/generate-sql`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({
                        userQuery: userQuery
                    })
                });
                console.log('API 호출 성공');
            } catch (localError) {
                console.error('API 호출 실패:', localError);
                throw localError;
            }

            if (!response.ok) {
                throw new Error(`Workers API 오류: HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                return {
                    success: true,
                    sql: data.generatedSQL,
                    data: data.data,
                    userQuery: userQuery
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Workers API에서 오류가 발생했습니다.',
                    userQuery: userQuery
                };
            }

        } catch (error) {
            console.error('Workers API 호출 실패:', error);
            console.log('🔄 샘플 데이터 모드로 전환');
            
            // 샘플 데이터로 응답 생성
            const sampleSQL = this.generateSampleSQL(userQuery);
            return {
                success: true,
                sql: sampleSQL,
                data: this.generateSampleData(sampleSQL),
                userQuery: userQuery,
                note: '⚠️ 데모 모드: 샘플 데이터로 응답합니다'
            };
        }
    }

    // 샘플 SQL 생성 (데모 모드용)
    generateSampleSQL(userQuery) {
        const query = userQuery.toLowerCase();
        
        // 특정 이름 검색 처리
        const nameMatch = userQuery.match(/['"]([가-힣]+)['"]|([가-힣]{2,4})/);
        if (nameMatch && (query.includes('급여') || query.includes('정보') || query.includes('직원'))) {
            const name = nameMatch[1] || nameMatch[2];
            return `SELECT name, department, salary, hire_date FROM employees WHERE name = '${name}';`;
        }
        
        if (query.includes('급여') && query.includes('높은')) {
            return 'SELECT name, department, salary FROM employees ORDER BY salary DESC LIMIT 3;';
        } else if (query.includes('부서') && query.includes('평균')) {
            return 'SELECT department, AVG(salary) AS avg_salary FROM employees GROUP BY department;';
        } else if (query.includes('2023') && query.includes('입사')) {
            return "SELECT COUNT(*) as count FROM employees WHERE hire_date >= '2023-01-01' AND hire_date <= '2023-12-31';";
        } else if (query.includes('프로젝트') && (query.includes('진행') || query.includes('종료일'))) {
            return 'SELECT * FROM projects WHERE end_date IS NULL;';
        } else if (query.includes('급여') && query.includes('5000')) {
            return 'SELECT name, department, salary FROM employees WHERE salary >= 50000000;';
        } else {
            return 'SELECT name, department, salary FROM employees LIMIT 5;';
        }
    }


    // Hive SQL 프롬프트 생성
    createHiveSQLPrompt(userQuery) {
        let schemaText = "다음은 사용 가능한 데이터베이스 테이블들입니다:\n\n";
        
        for (const [tableName, tableInfo] of Object.entries(CONFIG.DB_SCHEMA)) {
            schemaText += `테이블: ${tableName}\n`;
            schemaText += `설명: ${tableInfo.description}\n`;
            schemaText += `컬럼: ${tableInfo.columns.join(', ')}\n\n`;
        }

        return `당신은 자연어를 Hive SQL 쿼리로 변환하는 전문가입니다.

${schemaText}

Hive SQL 규칙:
1. 사용자의 자연어 질문을 정확한 Hive SQL 쿼리로 변환하세요
2. 오직 Hive SQL 쿼리만 응답하세요 (설명이나 다른 텍스트 없음)
3. 위에 제공된 테이블과 컬럼만 사용하세요
4. Hive SQL 문법을 사용하세요 (HiveQL)
5. 한국어 질문에 대해 적절한 Hive SQL을 생성하세요
6. 대용량 데이터 처리를 고려한 효율적인 쿼리를 생성하세요

사용자 질문: ${userQuery}

Hive SQL:`;
    }

    // Sybase SQL 프롬프트 생성
    createSybaseSQLPrompt(userQuery) {
        let schemaText = "다음은 사용 가능한 데이터베이스 테이블들입니다:\n\n";
        
        for (const [tableName, tableInfo] of Object.entries(CONFIG.DB_SCHEMA)) {
            schemaText += `테이블: ${tableName}\n`;
            schemaText += `설명: ${tableInfo.description}\n`;
            schemaText += `컬럼: ${tableInfo.columns.join(', ')}\n\n`;
        }

        return `당신은 자연어를 Sybase SQL 쿼리로 변환하는 전문가입니다.

${schemaText}

Sybase SQL 규칙:
1. 사용자의 자연어 질문을 정확한 Sybase SQL 쿼리로 변환하세요
2. 오직 Sybase SQL 쿼리만 응답하세요 (설명이나 다른 텍스트 없음)
3. 위에 제공된 테이블과 컬럼만 사용하세요
4. Sybase ASE/IQ 문법을 사용하세요
5. 한국어 질문에 대해 적절한 Sybase SQL을 생성하세요
6. Sybase 특화 기능을 사용할 수 있습니다 (ISNULL, GETDATE, DATEPART 등)

사용자 질문: ${userQuery}

Sybase SQL:`;
    }

    // 안전한 SQL 생성 (Workers만 사용)
    async generateSQL(userQuery) {
        const result = await this.generateAndExecuteSQL(userQuery);
        return {
            success: result.success,
            sql: result.sql,
            error: result.error,
            userQuery: userQuery
        };
    }

    // 샘플 데이터 생성 (실제 DB 연결 전까지 사용)
    generateSampleData(sqlQuery) {
        // 간단한 키워드 기반 샘플 데이터 생성
        if (sqlQuery.toLowerCase().includes('department') && sqlQuery.toLowerCase().includes('avg')) {
            return [
                { department: '개발팀', avg_salary: 58500000 },
                { department: '마케팅팀', avg_salary: 45200000 },
                { department: '영업팀', avg_salary: 52800000 },
                { department: '디자인팀', avg_salary: 48000000 }
            ];
        } else if (sqlQuery.toLowerCase().includes('salary') && (sqlQuery.toLowerCase().includes('>=') || sqlQuery.toLowerCase().includes('5000'))) {
            return [
                { name: '김철수', department: '개발팀', salary: 65000000 },
                { name: '이영희', department: '마케팅팀', salary: 52000000 },
                { name: '박민수', department: '영업팀', salary: 58000000 },
                { name: '정수진', department: '개발팀', salary: 72000000 },
                { name: '최영호', department: '디자인팀', salary: 55000000 }
            ];
        } else if (sqlQuery.toLowerCase().includes('높은') || sqlQuery.toLowerCase().includes('desc')) {
            return [
                { name: '정수진', department: '개발팀', salary: 72000000 },
                { name: '김철수', department: '개발팀', salary: 65000000 },
                { name: '박민수', department: '영업팀', salary: 58000000 }
            ];
        } else if (sqlQuery.toLowerCase().includes('2023') && sqlQuery.toLowerCase().includes('입사')) {
            return [
                { count: 8 }
            ];
        } else if (sqlQuery.toLowerCase().includes('project') && (sqlQuery.toLowerCase().includes('진행') || sqlQuery.toLowerCase().includes('null'))) {
            return [
                { id: 1, name: '모바일 앱 리뉴얼', start_date: '2024-01-15', budget: 180000000 },
                { id: 3, name: 'AI 시스템 구축', start_date: '2024-03-01', budget: 250000000 },
                { id: 5, name: '데이터 플랫폼 개발', start_date: '2024-06-01', budget: 320000000 }
            ];
        } else if (sqlQuery.toLowerCase().includes('project') && sqlQuery.toLowerCase().includes('budget')) {
            return [
                { name: '모바일 앱 리뉴얼', budget: 180000000, start_date: '2024-01-15' },
                { name: 'AI 시스템 구축', budget: 250000000, start_date: '2024-03-01' }
            ];
        } else {
            // 특정 이름으로 검색된 경우
            const nameMatch = userQuery.match(/['"]([가-힣]+)['"]|([가-힣]{2,4})/);
            if (nameMatch) {
                const searchName = nameMatch[1] || nameMatch[2];
                
                // 미리 정의된 직원 데이터
                const employees = [
                    { name: '김철수', department: '개발팀', salary: 65000000, hire_date: '2022-03-15' },
                    { name: '이영희', department: '마케팅팀', salary: 52000000, hire_date: '2021-07-20' },
                    { name: '박민수', department: '영업팀', salary: 58000000, hire_date: '2023-01-10' },
                    { name: '정수진', department: '개발팀', salary: 72000000, hire_date: '2020-11-05' },
                    { name: '최영호', department: '디자인팀', salary: 55000000, hire_date: '2022-09-12' },
                    { name: '정재훈', department: 'AI&Tech센터', salary: 68000000, hire_date: '2021-04-01' },
                    { name: '김지은', department: '기획팀', salary: 48000000, hire_date: '2023-06-15' },
                    { name: '이동민', department: '개발팀', salary: 62000000, hire_date: '2022-12-01' }
                ];
                
                const foundEmployee = employees.find(emp => emp.name === searchName);
                return foundEmployee ? [foundEmployee] : [{ message: `'${searchName}' 직원을 찾을 수 없습니다.` }];
            }
            
            // 기본 직원 목록
            return [
                { name: '김철수', department: '개발팀', salary: 65000000 },
                { name: '이영희', department: '마케팅팀', salary: 52000000 },
                { name: '박민수', department: '영업팀', salary: 58000000 },
                { name: '정수진', department: '개발팀', salary: 72000000 },
                { name: '정재훈', department: 'AI&Tech센터', salary: 68000000 }
            ];
        }
    }
}