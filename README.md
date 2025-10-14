# TTSQL - Text to SQL AI Assistant

한국어 자연어를 SQL 쿼리로 변환하여 데이터베이스를 조회할 수 있는 AI 기반 Assistant입니다.

## 🚀 주요 기능

- **한국어 자연어 → SQL 자동 변환**: "급여가 5천만원 이상인 직원" → SQL 쿼리
- **실시간 데이터베이스 조회**: 생성된 SQL 자동 실행 및 결과 표시
- **로컬 AI 모델**: Qwen 2.5 Coder 7B - 인터넷 없이 작동
- **Docker 기반 배포**: 원클릭 설치 및 실행
- **보안**: SQL Injection 자동 방지, SELECT 쿼리만 허용

## 🛠️ 기술 스택

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js + Express
- **Database**: SQLite (로컬)
- **AI Model**: Qwen 2.5 Coder 7B (via Ollama)
- **Infrastructure**: Docker + Docker Compose

## 🔄 전체 작동 플로우

### 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      사용자 (웹 브라우저)                      │
│                    http://localhost:8787                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ 한글 질문 입력
                         │ "급여가 5천만원 이상인 직원"
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (index.html)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  • 사용자 입력 받기                                      │  │
│  │  • api.js를 통해 백엔드 API 호출                         │  │
│  │  • 결과를 테이블 형태로 표시                              │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ POST /api/generate-sql
                         │ {userQuery: "급여가 5천만원..."}
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend (server.js - Port 8787)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. 한글 쿼리 수신                                       │  │
│  │  2. Ollama API로 전달                                   │  │
│  │  3. 생성된 SQL 받기                                      │  │
│  │  4. SQLite에서 SQL 실행                                 │  │
│  │  5. 결과 반환                                           │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ POST /v1/chat/completions
                         │ {model: "qwen2.5-coder:7b", ...}
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Ollama Service (Port 11434) - Docker              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │             Qwen 2.5 Coder 7B (AI 모델)               │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  • 한글 자연어 이해                               │  │  │
│  │  │  • 데이터베이스 스키마 인식                        │  │  │
│  │  │  • SQL 쿼리 생성                                 │  │  │
│  │  │  • "5천만원" → 50000000 자동 변환               │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ SQL 반환
                         │ "SELECT name, department, salary
                         │  FROM employees
                         │  WHERE salary >= 50000000;"
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            SQLite Database (로컬 파일 DB)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  테이블:                                               │  │
│  │  • employees (직원)                                   │  │
│  │  • departments (부서)                                 │  │
│  │  • projects (프로젝트)                                │  │
│  │  • employee_projects (참여관계)                       │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ 쿼리 결과
                         │ [{name: "김철수", ...}, ...]
                         │
                         ▼
              사용자에게 테이블로 표시
```

### 상세 처리 과정

#### 1️⃣ 사용자 입력 (Frontend)
```javascript
// index.html의 JavaScript
사용자가 "급여가 5천만원 이상인 직원" 입력
  ↓
sendMessage() 함수 호출
  ↓
ttsqlAPI.generateAndExecuteSQL(message) 호출
```

#### 2️⃣ API 호출 (api.js)
```javascript
// api.js - TTSQLAPI 클래스
fetch('/api/generate-sql', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({userQuery: "급여가 5천만원 이상인 직원"})
})
```

#### 3️⃣ 백엔드 처리 (server.js)
```javascript
// server.js - Express 서버
app.post('/api/generate-sql', async (req, res) => {
  const { userQuery } = req.body;

  // 1. Ollama API 호출
  const ollamaResponse = await fetch('http://localhost:11434/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'qwen2.5-coder:7b',
      messages: [
        {role: 'system', content: '한국어를 SQL로 변환...'},
        {role: 'user', content: userQuery}
      ]
    })
  });

  // 2. SQL 추출
  let sql = ollamaResponse.choices[0].message.content;

  // 3. SQLite 실행
  const results = db.prepare(sql).all();

  // 4. 결과 반환
  res.json({
    success: true,
    generatedSQL: sql,
    data: results
  });
});
```

#### 4️⃣ AI 모델 처리 (Ollama + Qwen)
```
입력: "급여가 5천만원 이상인 직원"

Qwen 2.5 Coder 7B 모델 처리:
├─ 한글 이해: "급여", "5천만원", "이상", "직원"
├─ 숫자 변환: 5천만원 → 50000000
├─ 스키마 매핑: employees 테이블의 salary 컬럼
└─ SQL 생성:
   SELECT name, department, salary
   FROM employees
   WHERE salary >= 50000000;
```

#### 5️⃣ 데이터베이스 조회
```sql
-- 생성된 SQL이 SQLite에서 실행됨
SELECT name, department, salary
FROM employees
WHERE salary >= 50000000;

-- 결과 반환
[
  {name: "김철수", department: "개발팀", salary: 55000000},
  {name: "이영희", department: "마케팅팀", salary: 52000000},
  ...
]
```

#### 6️⃣ 결과 표시 (Frontend)
```javascript
// index.html의 addMessage() 함수
결과를 HTML 테이블로 변환하여 표시

┌─────────┬──────────┬────────────┐
│  이름   │   부서   │    급여    │
├─────────┼──────────┼────────────┤
│ 김철수  │ 개발팀   │ 55,000,000원│
│ 이영희  │ 마케팅팀 │ 52,000,000원│
└─────────┴──────────┴────────────┘
```

### 보안 처리 과정

```
사용자 입력
  ↓
┌─────────────────────────────────┐
│  AI 레벨 보안 (Qwen 모델)        │
│  • SELECT 쿼리만 생성하도록 학습  │
│  • 위험한 SQL 문법 필터링         │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│  서버 레벨 보안 (server.js)      │
│  • SQL 코드 블록 제거            │
│  • 설명문 제거                   │
│  • 세미콜론 이후 텍스트 제거      │
└─────────────────────────────────┘
  ↓
안전한 SQL 실행
```

### Docker 컨테이너 구조

```
┌─────────────────────────────────────────────────────────┐
│              ttsql-app (Docker Container)               │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Ollama Service (백그라운드 실행)                  │  │
│  │  • Port: 11434                                   │  │
│  │  • Model: Qwen 2.5 Coder 7B (5GB)               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Node.js Server                                  │  │
│  │  • Port: 8787                                    │  │
│  │  • Express API                                   │  │
│  │  • Static File Serving (index.html)             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  SQLite Database                                 │  │
│  │  • 로컬 파일 DB                                   │  │
│  │  • Volume: ttsql-data                           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

Volume 매핑:
• ttsql-data → 데이터베이스 영구 저장
• ollama-models → AI 모델 영구 저장
```

### 성능 최적화

```
사용자 요청
  ↓
┌─────────────────────────────────┐
│  캐싱 레이어 (향후 추가 가능)     │
│  • 자주 사용되는 쿼리 캐싱        │
│  • SQL 결과 캐싱                 │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│  Ollama (로컬 AI)                │
│  • Temperature: 0.1 (일관성)     │
│  • Max Tokens: 200 (빠른 응답)   │
│  • Context Size: 2048           │
└─────────────────────────────────┘
  ↓
빠른 응답 (5-10초)
```

## 📋 빠른 시작 (Docker 사용)

### 시스템 요구사항
- Docker 20.10 이상
- Docker Compose 1.29 이상
- 최소 4GB RAM (권장: 8GB)
- 최소 10GB 디스크 공간

### 1. 프로젝트 복제
```bash
git clone <repository-url>
cd CoP_TTSQL
```

### 2. Docker로 실행 (원클릭!)

**방법 1: 자동 배포 스크립트 (권장)**
```bash
# Linux/macOS
chmod +x deploy.sh
./deploy.sh

# Windows
deploy.bat
```

**방법 2: 수동 실행**
```bash
# Docker Compose로 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 3. 접속
- **웹 인터페이스**: http://localhost:8787
- **Ollama API**: http://localhost:11434

### 4. 중지 및 재시작
```bash
# 중지
docker-compose down

# 재시작
docker-compose restart

# 데이터 포함 완전 삭제
docker-compose down -v
```

## 💻 로컬 개발 (Docker 없이)

### 1. 의존성 설치
```bash
npm install
```

### 2. Ollama 설치
```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# https://ollama.com/download 에서 설치
```

### 3. Qwen 모델 설치
```bash
ollama pull qwen2.5-coder:7b
```

### 4. 데이터베이스 초기화
```bash
mkdir -p .wrangler/state/v3/d1/miniflare-D1DatabaseObject
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/564d6d4472287d20481b022665002f2909cb38565ac6b37af2e9b098a112a750.sqlite < schema.sql
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/564d6d4472287d20481b022665002f2909cb38565ac6b37af2e9b098a112a750.sqlite < seed.sql
```

### 5. 서버 실행
```bash
# Ollama 서비스 시작 (백그라운드)
ollama serve &

# Node.js 서버 시작
node server.js
```

## 🔒 보안 기능

### SQL Injection 방지
- AI 레벨: Qwen 모델이 SELECT 쿼리만 생성하도록 학습됨
- 서버 레벨: 위험한 키워드 차단 (DROP, DELETE, INSERT 등)
- SELECT 문만 실행 허용

### 데이터 프라이버시
- 로컬 AI 모델 사용 - 외부 API 호출 없음
- 모든 데이터가 로컬 서버에만 저장
- 인터넷 없이도 작동 가능

## 📁 프로젝트 구조

```
CoP_TTSQL/
├── README.md                 # 프로젝트 문서
├── DEPLOYMENT.md            # 배포 가이드
├── package.json             # Node.js 의존성
├── Dockerfile               # Docker 이미지 빌드
├── docker-compose.yml       # Docker Compose 설정
├── docker-entrypoint.sh     # 컨테이너 시작 스크립트
├── Modelfile                # Ollama 커스텀 모델 설정
├── server.js                # Node.js Express 서버
├── api.js                   # API 클라이언트
├── config.js                # 설정 파일
├── index.html               # 메인 웹 페이지
├── schema.sql               # 데이터베이스 스키마
├── seed.sql                 # 샘플 데이터
├── test-korean.js           # 한글→SQL 테스트 스크립트
└── images/                  # 이미지 리소스
```

## 🚀 배포

자세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

### Docker Hub 배포
```bash
# 이미지 빌드
docker build -t your-username/ttsql:latest .

# Docker Hub 푸시
docker push your-username/ttsql:latest
```

### 클라우드 서버 배포
- AWS EC2
- Google Cloud Platform
- DigitalOcean
- 자체 서버

자세한 내용은 DEPLOYMENT.md를 참고하세요.

## 🧪 테스트

### 한글→SQL 변환 테스트
```bash
node test-korean.js
```

### API 테스트
```bash
# 헬스체크
curl http://localhost:8787/api/test

# SQL 생성 테스트
curl -X POST http://localhost:8787/api/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"userQuery":"급여가 5천만원 이상인 직원 찾기"}'
```

## 📊 지원하는 쿼리 예시

- "급여가 5천만원 이상인 직원 찾기"
- "개발팀 직원 목록 보여줘"
- "급여가 높은 직원 5명"
- "이름에 김이 들어간 직원"
- "2023년에 입사한 직원"
- "부서별 평균 급여"

더 많은 예시는 `Modelfile`을 참고하세요.

## ⚠️ 주의사항

1. **AI 모델**: 첫 실행 시 Qwen 모델 다운로드에 시간이 걸립니다 (~5GB)
2. **메모리**: AI 모델 실행에 최소 4GB RAM이 필요합니다
3. **포트**: 8787, 11434 포트가 사용 가능해야 합니다

## 📄 라이선스

MIT License