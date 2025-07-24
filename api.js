// ChatGPT API 연동 함수들

class TTSQLAPI {
    constructor() {
        this.apiKey = CONFIG.OPENAI_API_KEY;
        this.apiUrl = CONFIG.OPENAI_API_URL;
        this.model = CONFIG.MODEL;
        this.workerUrl = CONFIG.WORKER_URL || 'http://127.0.0.1:8787';
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
            console.log('Testing connection to:', `${this.workerUrl}/api/test`);
            const response = await fetch(`${this.workerUrl}/api/test`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Connection test result:', data);
            return data;
            
        } catch (error) {
            console.error('Connection test failed:', error);
            throw error;
        }
    }

    // Workers API를 통한 Hive SQL 생성 및 실행 (D1에서 시뮬레이션)
    async generateAndExecuteHiveSQL(userQuery) {
        try {
            const response = await fetch(`${this.workerUrl}/api/execute-hive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userQuery: userQuery,
                    apiKey: this.apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`Workers API 요청 실패: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                return {
                    success: true,
                    sql: data.generatedHiveSQL,
                    convertedSQL: data.convertedSQLiteSQL,
                    data: data.data,
                    meta: data.meta,
                    queryType: 'hive-simulated',
                    note: data.note,
                    executionTime: data.executionTime,
                    userQuery: userQuery
                };
            } else {
                return {
                    success: false,
                    error: data.error,
                    message: data.message,
                    userQuery: userQuery
                };
            }

        } catch (error) {
            console.error('Hive SQL 실행 오류:', error);
            return {
                success: false,
                error: error.message,
                userQuery: userQuery
            };
        }
    }

    // Workers API를 통한 Sybase SQL 생성 및 실행 (D1에서 시뮬레이션)
    async generateAndExecuteSybaseSQL(userQuery) {
        try {
            const response = await fetch(`${this.workerUrl}/api/execute-sybase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userQuery: userQuery,
                    apiKey: this.apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`Workers API 요청 실패: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                return {
                    success: true,
                    sql: data.generatedSybaseSQL,
                    convertedSQL: data.convertedSQLiteSQL,
                    data: data.data,
                    meta: data.meta,
                    queryType: 'sybase-simulated',
                    note: data.note,
                    executionTime: data.executionTime,
                    userQuery: userQuery
                };
            } else {
                return {
                    success: false,
                    error: data.error,
                    message: data.message,
                    userQuery: userQuery
                };
            }

        } catch (error) {
            console.error('Sybase SQL 실행 오류:', error);
            return {
                success: false,
                error: error.message,
                userQuery: userQuery
            };
        }
    }

    // Workers API를 통한 Sybase SQL 생성 (쿼리만 생성, 실행 안함)
    async generateSybaseSQL(userQuery) {
        try {
            const response = await fetch(`${this.workerUrl}/api/generate-sybase`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userQuery: userQuery,
                    apiKey: this.apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`Workers API 요청 실패: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                return {
                    success: true,
                    sql: data.generatedSybaseSQL,
                    queryType: 'sybase',
                    note: data.note,
                    userQuery: userQuery
                };
            } else {
                return {
                    success: false,
                    error: data.error,
                    message: data.message,
                    userQuery: userQuery
                };
            }

        } catch (error) {
            console.error('Sybase SQL 생성 오류:', error);
            return {
                success: false,
                error: error.message,
                userQuery: userQuery
            };
        }
    }

    // Workers API를 통한 Hive SQL 생성 (쿼리만 생성, 실행 안함)
    async generateHiveSQL(userQuery) {
        try {
            const response = await fetch(`${this.workerUrl}/api/generate-hive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userQuery: userQuery,
                    apiKey: this.apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`Workers API 요청 실패: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                return {
                    success: true,
                    sql: data.generatedHiveSQL,
                    queryType: 'hive',
                    note: data.note,
                    userQuery: userQuery
                };
            } else {
                return {
                    success: false,
                    error: data.error,
                    message: data.message,
                    userQuery: userQuery
                };
            }

        } catch (error) {
            console.error('Hive SQL 생성 오류:', error);
            return {
                success: false,
                error: error.message,
                userQuery: userQuery
            };
        }
    }

    // Workers API를 통한 SQL 생성 및 실행 (새로운 방법)
    async generateAndExecuteSQL(userQuery) {
        try {
            const response = await fetch(`${this.workerUrl}/api/generate-sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userQuery: userQuery,
                    apiKey: this.apiKey
                })
            });

            if (!response.ok) {
                throw new Error(`Workers API 요청 실패: ${response.status}`);
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
                    error: data.error,
                    message: data.message,
                    userQuery: userQuery
                };
            }

        } catch (error) {
            console.error('Workers API 호출 오류:', error);
            return {
                success: false,
                error: error.message,
                userQuery: userQuery
            };
        }
    }

    // OpenAI API 호출 (기존 방법, 백업용)
    async generateSQL(userQuery) {
        try {
            const prompt = this.createSQLPrompt(userQuery);
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
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
                throw new Error(`API 요청 실패: ${response.status}`);
            }

            const data = await response.json();
            const sqlQuery = data.choices[0].message.content.trim();
            
            return {
                success: true,
                sql: sqlQuery,
                userQuery: userQuery
            };

        } catch (error) {
            console.error('SQL 생성 오류:', error);
            return {
                success: false,
                error: error.message,
                userQuery: userQuery
            };
        }
    }

    // 샘플 데이터 생성 (실제 DB 연결 전까지 사용)
    generateSampleData(sqlQuery) {
        // 간단한 키워드 기반 샘플 데이터 생성
        if (sqlQuery.toLowerCase().includes('department') && sqlQuery.toLowerCase().includes('avg')) {
            return [
                { department: '개발팀', avg_salary: '55000000' },
                { department: '마케팅팀', avg_salary: '48000000' },
                { department: '영업팀', avg_salary: '52000000' }
            ];
        } else if (sqlQuery.toLowerCase().includes('salary') && sqlQuery.toLowerCase().includes('>=')) {
            return [
                { name: '김철수', department: '개발팀', salary: '55000000' },
                { name: '이영희', department: '마케팅팀', salary: '52000000' },
                { name: '박민수', department: '영업팀', salary: '58000000' }
            ];
        } else if (sqlQuery.toLowerCase().includes('project') && sqlQuery.toLowerCase().includes('budget')) {
            return [
                { name: '모바일 앱 개발', budget: '150000000', start_date: '2024-01-15' },
                { name: 'AI 시스템 구축', budget: '200000000', start_date: '2024-03-01' }
            ];
        } else {
            return [
                { id: 1, name: '샘플 데이터', department: '개발팀' },
                { id: 2, name: '테스트 데이터', department: '마케팅팀' }
            ];
        }
    }
}