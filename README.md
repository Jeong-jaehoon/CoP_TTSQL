# TTSQL - Text-to-SQL AI Assistant

**IBK기업은행 X 뽑아조 프로젝트**

자연어 질문을 SQL 쿼리로 자동 변환하여 데이터베이스를 조회하는 AI 기반 웹 애플리케이션

## 목차
- [프로젝트 개요](#프로젝트-개요)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [시스템 아키텍처](#시스템-아키텍처)
- [설치 및 실행](#설치-및-실행)
- [사용 방법](#사용-방법)
- [데이터베이스 스키마](#데이터베이스-스키마)
- [AI 모델 설정](#ai-모델-설정)
- [배포](#배포)
- [문제 해결](#문제-해결)

## 프로젝트 개요

TTSQL은 비개발자도 자연어로 데이터베이스를 조회할 수 있도록 돕는 AI 기반 SQL 생성 시스템입니다.

### 주요 특징
- 한국어 자연어 질문을 정확한 SQL 쿼리로 변환
- Ollama 기반 로컬 AI 모델 사용 (외부 API 의존성 없음)
- Docker 컨테이너화된 배포 환경
- 실시간 쿼리 실행 및 결과 표시

### 데모
- **배포 URL**: ngrok 터널링을 통한 외부 접근 가능
- **예시 질문**:
  - "개발본부 직원들 보여줘"
  - "급여가 높은 직원 3명"
  - "2023년에 입사한 직원들"
  - "부서별 직원 수"

## 주요 기능

### 1. 자연어-to-SQL 변환
- AI 모델(qwen2.5-coder:7b)을 사용한 정확한 SQL 생성
- SQLite 문법 지원
- JOIN 쿼리 자동 생성

### 2. 실시간 데이터 조회
- SQL 쿼리 자동 실행
- 테이블 형태로 결과 표시
- 조회 결과 없음 시 안내 메시지

### 3. 사용자 친화적 UI
- 4가지 예시 쿼리 버튼
- 테이블 스키마 조회 기능
- 반응형 디자인

### 4. 데이터베이스 스키마 정보
- 10개 테이블 정보 제공
- 컬럼별 상세 설명
- 실시간 스키마 조회

## 기술 스택

### Backend
- **Node.js** (v20): 서버 런타임
- **Express.js**: RESTful API 프레임워크
- **better-sqlite3**: SQLite 데이터베이스 드라이버
- **Ollama**: 로컬 LLM 서버
- **qwen2.5-coder:7b**: SQL 생성 특화 AI 모델

### Frontend
- **Vanilla JavaScript**: 프론트엔드 로직
- **HTML5/CSS3**: UI 구성
- **Fetch API**: 비동기 통신

### Infrastructure
- **Docker**: 컨테이너화
- **Docker Compose**: 멀티 컨테이너 관리
- **ngrok**: 외부 접근을 위한 터널링

### Database
- **SQLite**: 경량 관계형 데이터베이스
- **Cloudflare D1**: (프로덕션 환경)

## 시스템 아키텍처

```
┌─────────────┐
│   사용자    │
└──────┬──────┘
       │ 자연어 질문
       ↓
┌─────────────────────────────────┐
│     Frontend (index.html)       │
│  - 사용자 입력                   │
│  - 결과 표시                     │
└──────┬──────────────────────────┘
       │ HTTP POST
       ↓
┌─────────────────────────────────┐
│  Backend (server.js:8787)       │
│  - API 엔드포인트                │
│  - SQL 실행                      │
└──────┬──────────────────────────┘
       │ Ollama API Call
       ↓
┌─────────────────────────────────┐
│   Ollama (localhost:11434)      │
│  - qwen2.5-coder:7b 모델        │
│  - SQL 쿼리 생성                 │
└─────────────────────────────────┘
       │ SQL 쿼리
       ↓
┌─────────────────────────────────┐
│   SQLite Database               │
│  - employees, departments, ...  │
└─────────────────────────────────┘
```

## 설치 및 실행

### 사전 요구사항
- Docker Desktop 설치
- Docker Compose 설치
- 최소 8GB RAM (AI 모델 구동용)

### 1. 저장소 클론
```bash
git clone https://github.com/yourusername/CoP_TTSQL.git
cd CoP_TTSQL
```

### 2. Docker 컨테이너 실행
```bash
docker-compose up -d
```

### 3. AI 모델 생성 (최초 1회)
```bash
# qwen2.5-coder:7b 모델 다운로드 (약 4.7GB)
docker exec ttsql-app ollama pull qwen2.5-coder:7b

# 커스텀 모델 생성
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"
```

### 4. 데이터베이스 초기화 (선택)
```bash
# 데이터베이스 디렉토리 확인
docker exec ttsql-app ls -la /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/

# SQL 스키마 실행 (필요시)
docker exec ttsql-app sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite < schema.sql
```

### 5. 접속 확인
- **로컬**: http://localhost:8787
- **ngrok**: ngrok 설정 시 외부 URL 사용 가능

## 사용 방법

### 기본 사용
1. 웹 브라우저에서 http://localhost:8787 접속
2. 자연어로 질문 입력 또는 예시 버튼 클릭
3. AI가 생성한 SQL 쿼리 확인
4. 조회 결과 확인

### 예시 질문
```
개발본부 직원들 보여줘
급여가 5천만원 이상인 직원
2023년에 입사한 직원들
부서별 평균 급여
급여가 높은 직원 3명
```

### 테이블 스키마 조회
1. 상단 메뉴에서 "테이블 목록" 클릭
2. 10개 테이블 정보 확인
3. 컬럼 상세 정보 확인

## 데이터베이스 스키마

### 주요 테이블

#### 1. employees (직원 정보)
```sql
- id: 직원 ID (PRIMARY KEY)
- employee_number: 사번 (UNIQUE)
- name: 이름
- department_id: 부서 ID (FK → departments)
- position: 직급 (사원/대리/과장/차장/부장/임원)
- job_title: 직책
- salary: 급여
- hire_date: 입사일
- manager_id: 직속 상사 ID
- performance_score: 성과 점수
```

#### 2. departments (부서 정보)
```sql
- id: 부서 ID (PRIMARY KEY)
- dept_code: 부서 코드 (UNIQUE)
- name: 부서명 (개발본부, 경영지원본부 등)
- parent_dept_id: 상위 부서 ID (계층 구조)
- dept_level: 부서 레벨 (1=본부, 2=팀, 3=파트)
- manager_id: 부서장 ID
- budget: 예산
- employee_count: 소속 직원 수
```

#### 3. projects (프로젝트 정보)
```sql
- id: 프로젝트 ID
- name: 프로젝트명
- start_date: 시작일
- end_date: 종료일
- budget: 예산
```

### JOIN 예시
```sql
-- 부서명과 함께 직원 조회
SELECT e.name, e.salary, d.name as department
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE d.name LIKE '%개발%';
```

## AI 모델 설정

### 모델 정보
- **기본 모델**: qwen2.5-coder:7b
- **크기**: 4.7GB
- **특징**: 코딩 특화, SQL 생성에 최적화

### Modelfile 주요 설정
```modelfile
FROM qwen2.5-coder:7b

PARAMETER temperature 0.01    # 낮은 값: 결정적 출력
PARAMETER top_p 0.5           # 상위 50% 토큰만 고려
PARAMETER top_k 10            # 상위 10개 토큰만 고려
PARAMETER num_ctx 2048        # 컨텍스트 윈도우
PARAMETER repeat_penalty 1.1  # 반복 방지
```

### 모델 업데이트 방법
```bash
# 1. Modelfile 수정
vim Modelfile

# 2. 컨테이너에 복사
docker cp Modelfile ttsql-app:/app/Modelfile

# 3. 모델 재생성
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"

# 4. 컨테이너 재시작
docker-compose restart
```

## 배포

### 로컬 개발
```bash
# 서버 시작
node server.js

# 접속
http://localhost:8787
```

### Docker 배포
```bash
# 컨테이너 빌드 및 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 컨테이너 중지
docker-compose down
```

### ngrok 터널링
```bash
# ngrok 설치 후
ngrok http 8787

# 생성된 URL로 외부 접속 가능
# 예: https://xxxx-yyyy-zzzz.ngrok-free.dev
```

### ngrok 경고 페이지 제거
본 애플리케이션은 ngrok 경고 페이지를 자동으로 우회합니다:
- `index.html`에 meta 태그 추가
- API 요청 시 `ngrok-skip-browser-warning` 헤더 포함
- 서버 CORS 설정에 헤더 허용

## 문제 해결

### 1. AI 모델이 SQL을 생성하지 못함
**증상**: "I can't help with that" 또는 대화 시작

**해결방법**:
```bash
# qwen2.5-coder:7b 모델 사용 확인
docker exec ttsql-app ollama list

# ttsql-model 재생성
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"
```

### 2. 불필요한 조건이 SQL에 추가됨
**예시**: `AND e.position IN ('부장', '임원')` 같은 조건

**해결방법**:
- Modelfile의 SYSTEM 프롬프트 확인
- 예시 쿼리에 올바른 패턴 추가
- temperature를 낮춰서 더 결정적으로 만들기

### 3. 이미지가 깨져서 표시됨
**해결방법**:
```bash
# Dockerfile에 images 디렉토리 COPY 확인
# 컨테이너 재빌드
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 4. CORS 에러
**증상**: `blocked by CORS policy`

**해결방법**:
`server.js`의 CORS 설정 확인:
```javascript
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
  credentials: false
}));
```

### 5. 데이터베이스 연결 실패
**해결방법**:
```bash
# 데이터베이스 파일 존재 확인
docker exec ttsql-app ls -la /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/

# 권한 확인
docker exec ttsql-app chmod 666 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
```

## API 엔드포인트

### POST /api/generate-sql
자연어 질문을 SQL로 변환하고 실행

**Request**:
```json
{
  "userQuery": "개발본부 직원들 보여줘"
}
```

**Response**:
```json
{
  "success": true,
  "userQuery": "개발본부 직원들 보여줘",
  "generatedSQL": "SELECT e.name, e.salary, d.name as department FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.name LIKE '%개발%';",
  "data": [
    {
      "name": "김철수",
      "salary": 60000000,
      "department": "개발본부"
    }
  ],
  "meta": {
    "rows": 1
  }
}
```

### GET /api/test
API 연결 테스트

**Response**:
```json
{
  "success": true,
  "message": "Node.js API is working!",
  "timestamp": "2025-10-15T..."
}
```

### GET /api/schema
데이터베이스 스키마 정보 조회

**Response**:
```json
{
  "success": true,
  "schema": {
    "employees": {
      "columns": ["id", "name", "department_id", "salary", "hire_date"],
      "description": "직원 정보 테이블"
    },
    ...
  }
}
```

## 프로젝트 구조

```
CoP_TTSQL/
├── docker-compose.yml          # Docker Compose 설정
├── Dockerfile                  # Docker 이미지 빌드 설정
├── docker-entrypoint.sh        # 컨테이너 시작 스크립트
├── Modelfile                   # Ollama 모델 설정
├── server.js                   # Express.js 서버
├── package.json                # Node.js 의존성
├── index.html                  # 프론트엔드 UI
├── api.js                      # API 클라이언트
├── config.js                   # 애플리케이션 설정
├── images/                     # 이미지 파일
│   ├── ibk-logo.png
│   └── mascot.png
├── .wrangler/                  # SQLite 데이터베이스
│   └── state/v3/d1/...
├── README.md                   # 프로젝트 문서 (본 파일)
└── CONVERSATION_HISTORY.md     # 개발 과정 기록
```

## 성능 최적화

### AI 모델 응답 속도
- **temperature=0.01**: 결정적 출력, 빠른 응답
- **top_k=10**: 후보 토큰 제한, 연산량 감소
- **max_tokens=150**: SQL 쿼리만 생성, 불필요한 텍스트 방지

### 데이터베이스
- **SQLite**: 경량, 빠른 조회
- **인덱스**: 주요 컬럼에 인덱스 설정 권장
- **JOIN 최적화**: LEFT JOIN vs INNER JOIN 적절히 사용

## 라이센스
이 프로젝트는 IBK기업은행 X 뽑아조 팀의 소유입니다.

## 연락처
- 프로젝트 관련 문의: [Contact us]
- 이슈 리포트: GitHub Issues

## 버전 히스토리
- **v1.0.0** (2025-10-15)
  - qwen2.5-coder:7b 모델 적용
  - ngrok 경고 페이지 제거
  - 테이블 스키마 조회 기능 추가
  - Position filter 버그 수정
  - UI/UX 개선

---

**Made with qwen2.5-coder:7b and Ollama**
