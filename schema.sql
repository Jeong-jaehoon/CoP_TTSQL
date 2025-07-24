-- TTSQL 데이터베이스 스키마
-- 직원 테이블
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    salary INTEGER NOT NULL,
    hire_date DATE NOT NULL
);

-- 부서 테이블
CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    manager_id INTEGER,
    budget INTEGER NOT NULL,
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);

-- 프로젝트 테이블
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    budget INTEGER NOT NULL
);

-- 직원-프로젝트 관계 테이블
CREATE TABLE IF NOT EXISTS employee_projects (
    employee_id INTEGER,
    project_id INTEGER,
    role TEXT,
    PRIMARY KEY (employee_id, project_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);