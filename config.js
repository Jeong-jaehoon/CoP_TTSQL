// OpenAI API 설정
const CONFIG = {
    OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY_HERE', // Replace with your actual API key
    OPENAI_API_URL: 'https://api.openai.com/v1/chat/completions',
    MODEL: 'gpt-3.5-turbo',
    WORKER_URL: 'http://127.0.0.1:8787', // 개발 환경용, 배포시 실제 URL로 변경
    
    // 쿼리 타입 설정
    QUERY_TYPES: {
        SQLITE: 'sqlite',
        HIVE: 'hive'
    },
    DEFAULT_QUERY_TYPE: 'sqlite', // 기본값
    
    // 데이터베이스 스키마 정보
    DB_SCHEMA: {
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
        }
    }
};