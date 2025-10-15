-- 기업용 고도화 데이터베이스 스키마 (v2)
-- 실제 기업 환경을 시뮬레이션하는 복잡한 구조

-- 1. 직원 정보 테이블 (확장)
DROP TABLE IF EXISTS employees;
CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_number VARCHAR(20) UNIQUE NOT NULL,  -- 사번 (예: EMP20240001)
    name TEXT NOT NULL,
    name_english VARCHAR(100),  -- 영문 이름
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    department_id INTEGER,  -- 부서 ID (FK)
    position VARCHAR(50),  -- 직급 (사원, 대리, 과장, 차장, 부장, 임원)
    job_title VARCHAR(100),  -- 직책 (팀장, 파트장 등)
    employment_type VARCHAR(20),  -- 고용형태 (정규직, 계약직, 인턴)
    salary INTEGER NOT NULL,
    bonus_rate REAL DEFAULT 0,  -- 보너스 비율 (예: 200% = 2.0)
    hire_date DATE NOT NULL,
    resignation_date DATE,  -- 퇴사일 (NULL = 재직중)
    manager_id INTEGER,  -- 직속 상사 ID
    office_location VARCHAR(50),  -- 근무지 (본사, 판교, 강남, 부산 등)
    work_type VARCHAR(20) DEFAULT '사무직',  -- 근무형태 (사무직, 현장직, 재택)
    birth_date DATE,
    gender VARCHAR(10),
    address TEXT,
    emergency_contact VARCHAR(100),
    education VARCHAR(50),  -- 학력 (고졸, 학사, 석사, 박사)
    major VARCHAR(100),  -- 전공
    skills TEXT,  -- 보유 기술 (JSON 형태 저장 가능)
    certifications TEXT,  -- 자격증 목록
    performance_score REAL,  -- 성과 점수 (0-100)
    attendance_score REAL,  -- 근태 점수 (0-100)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);

-- 2. 부서 정보 테이블 (확장)
DROP TABLE IF EXISTS departments;
CREATE TABLE departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dept_code VARCHAR(20) UNIQUE NOT NULL,  -- 부서 코드 (예: DEV001)
    name TEXT NOT NULL,
    name_english VARCHAR(100),
    parent_dept_id INTEGER,  -- 상위 부서 ID (계층 구조)
    dept_level INTEGER DEFAULT 1,  -- 부서 레벨 (1=본부, 2=팀, 3=파트)
    manager_id INTEGER,  -- 부서장
    budget INTEGER NOT NULL DEFAULT 0,
    budget_used INTEGER DEFAULT 0,  -- 사용한 예산
    employee_count INTEGER DEFAULT 0,  -- 소속 직원 수
    office_location VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    established_date DATE,  -- 부서 설립일
    description TEXT,
    is_active BOOLEAN DEFAULT 1,  -- 활성 여부
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_dept_id) REFERENCES departments(id),
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);

-- 3. 프로젝트 정보 테이블 (확장)
DROP TABLE IF EXISTS projects;
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code VARCHAR(20) UNIQUE NOT NULL,  -- 프로젝트 코드
    name TEXT NOT NULL,
    name_english VARCHAR(200),
    description TEXT,
    client VARCHAR(100),  -- 고객사
    project_type VARCHAR(50),  -- 프로젝트 유형 (SI, SM, 자체개발, R&D)
    status VARCHAR(20) DEFAULT '진행중',  -- 상태 (기획, 진행중, 완료, 중단, 보류)
    priority VARCHAR(20) DEFAULT '보통',  -- 우선순위 (긴급, 높음, 보통, 낮음)
    start_date DATE NOT NULL,
    end_date DATE,
    actual_end_date DATE,  -- 실제 종료일
    budget INTEGER NOT NULL,
    budget_used INTEGER DEFAULT 0,
    expected_revenue INTEGER,  -- 예상 수익
    actual_revenue INTEGER,  -- 실제 수익
    pm_id INTEGER,  -- 프로젝트 매니저 ID
    department_id INTEGER,  -- 주관 부서
    completion_rate REAL DEFAULT 0,  -- 진행률 (%)
    risk_level VARCHAR(20) DEFAULT '보통',  -- 위험도 (높음, 보통, 낮음)
    technology_stack TEXT,  -- 기술 스택 (JSON)
    milestones TEXT,  -- 마일스톤 정보 (JSON)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pm_id) REFERENCES employees(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 4. 프로젝트 참여자 테이블 (확장)
DROP TABLE IF EXISTS project_members;
CREATE TABLE project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    role VARCHAR(50),  -- 역할 (PM, PL, 개발자, 디자이너, QA 등)
    participation_rate REAL DEFAULT 100,  -- 투입률 (%)
    join_date DATE NOT NULL,
    leave_date DATE,
    work_hours REAL DEFAULT 0,  -- 투입 시간 (hours)
    contribution_score REAL,  -- 기여도 점수
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(project_id, employee_id)
);

-- 5. 급여 지급 내역 테이블 (신규)
DROP TABLE IF EXISTS salary_payments;
CREATE TABLE salary_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    payment_date DATE NOT NULL,  -- 지급일
    year_month VARCHAR(7) NOT NULL,  -- 년월 (2024-01)
    base_salary INTEGER NOT NULL,  -- 기본급
    bonus INTEGER DEFAULT 0,  -- 보너스
    overtime_pay INTEGER DEFAULT 0,  -- 야근수당
    allowances INTEGER DEFAULT 0,  -- 각종 수당
    deductions INTEGER DEFAULT 0,  -- 공제액 (세금, 보험 등)
    total_payment INTEGER NOT NULL,  -- 실지급액
    payment_status VARCHAR(20) DEFAULT '완료',  -- 지급 상태
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- 6. 근태 기록 테이블 (신규)
DROP TABLE IF EXISTS attendance;
CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    work_date DATE NOT NULL,
    check_in_time TIME,  -- 출근 시각
    check_out_time TIME,  -- 퇴근 시각
    work_hours REAL,  -- 근무 시간
    overtime_hours REAL DEFAULT 0,  -- 야근 시간
    status VARCHAR(20) DEFAULT '정상',  -- 상태 (정상, 지각, 조퇴, 결근, 휴가, 출장)
    leave_type VARCHAR(20),  -- 휴가 종류 (연차, 병가, 경조사 등)
    notes TEXT,
    approved_by INTEGER,  -- 승인자
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id),
    UNIQUE(employee_id, work_date)
);

-- 7. 휴가 신청 테이블 (신규)
DROP TABLE IF EXISTS leave_requests;
CREATE TABLE leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    leave_type VARCHAR(20) NOT NULL,  -- 연차, 병가, 경조사, 반차
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days REAL NOT NULL,  -- 사용 일수
    reason TEXT,
    status VARCHAR(20) DEFAULT '대기',  -- 대기, 승인, 반려, 취소
    approver_id INTEGER,
    approved_at DATETIME,
    request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (approver_id) REFERENCES employees(id)
);

-- 8. 평가 기록 테이블 (신규)
DROP TABLE IF EXISTS performance_reviews;
CREATE TABLE performance_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    review_period VARCHAR(20) NOT NULL,  -- 평가 기간 (2024-H1, 2024-Q1 등)
    review_type VARCHAR(20),  -- 평가 유형 (연간, 반기, 분기)
    reviewer_id INTEGER NOT NULL,  -- 평가자
    performance_score REAL,  -- 업무 성과 (0-100)
    competency_score REAL,  -- 역량 평가 (0-100)
    attitude_score REAL,  -- 근무 태도 (0-100)
    total_score REAL,  -- 총점
    grade VARCHAR(10),  -- 등급 (S, A, B, C, D)
    promotion_recommended BOOLEAN DEFAULT 0,  -- 승진 추천 여부
    salary_increase_rate REAL,  -- 급여 인상률 (%)
    strengths TEXT,  -- 강점
    weaknesses TEXT,  -- 약점
    improvement_plan TEXT,  -- 개선 계획
    comments TEXT,
    review_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (reviewer_id) REFERENCES employees(id)
);

-- 9. 교육 이수 기록 테이블 (신규)
DROP TABLE IF EXISTS training_records;
CREATE TABLE training_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    training_name VARCHAR(200) NOT NULL,
    training_type VARCHAR(50),  -- 외부교육, 사내교육, 온라인, 세미나
    provider VARCHAR(100),  -- 교육 기관
    start_date DATE,
    end_date DATE,
    duration_hours REAL,  -- 교육 시간
    cost INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT '완료',  -- 신청, 진행중, 완료, 취소
    completion_rate REAL,  -- 이수율 (%)
    score REAL,  -- 점수
    certificate_issued BOOLEAN DEFAULT 0,  -- 수료증 발급 여부
    skills_acquired TEXT,  -- 습득 기술
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- 10. 자산 관리 테이블 (신규)
DROP TABLE IF EXISTS assets;
CREATE TABLE assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_code VARCHAR(20) UNIQUE NOT NULL,
    asset_name VARCHAR(100) NOT NULL,
    asset_type VARCHAR(50),  -- 노트북, 데스크탑, 모니터, 휴대폰 등
    model VARCHAR(100),
    serial_number VARCHAR(100),
    purchase_date DATE,
    purchase_price INTEGER,
    assigned_to INTEGER,  -- 사용자
    department_id INTEGER,
    status VARCHAR(20) DEFAULT '정상',  -- 정상, 수리중, 폐기, 분실
    location VARCHAR(100),
    warranty_until DATE,  -- 보증 기한
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES employees(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_employees_hire_date ON employees(hire_date);
CREATE INDEX idx_employees_position ON employees(position);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX idx_salary_payments_date ON salary_payments(year_month);
CREATE INDEX idx_attendance_date ON attendance(work_date);
CREATE INDEX idx_attendance_employee ON attendance(employee_id, work_date);
