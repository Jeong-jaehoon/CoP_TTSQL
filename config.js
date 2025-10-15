// 공개용 애플리케이션 설정
const CONFIG = {
    // Workers URL 설정
    // 로컬 개발: '' (상대 경로)
    // 프로덕션: ngrok URL 사용
    WORKER_URL: '', // 상대 경로 (ngrok/localhost 모두 호환)
    
    // 쿼리 타입 설정
    QUERY_TYPES: {
        SQLITE: 'sqlite',
        HIVE: 'hive'
    },
    DEFAULT_QUERY_TYPE: 'sqlite',
    
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
        },
        employee_projects: {
            columns: ['employee_id', 'project_id', 'role'],
            description: '직원-프로젝트 관계 테이블'
        }
    }
};