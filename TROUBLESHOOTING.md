# TTSQL 문제 해결 가이드

**최종 업데이트**: 2025-10-15
**난이도 표시**: 🟢 쉬움 | 🟡 보통 | 🔴 어려움

이 문서는 TTSQL 프로젝트에서 발생할 수 있는 모든 문제와 해결 방법을 다룹니다.

---

## 목차
1. [AI 모델 관련 문제](#1-ai-모델-관련-문제)
2. [Docker 컨테이너 문제](#2-docker-컨테이너-문제)
3. [데이터베이스 문제](#3-데이터베이스-문제)
4. [API 연결 문제](#4-api-연결-문제)
5. [CORS 및 네트워크 문제](#5-cors-및-네트워크-문제)
6. [SQL 생성 오류](#6-sql-생성-오류)
7. [UI/Frontend 문제](#7-uifrontend-문제)
8. [ngrok 관련 문제](#8-ngrok-관련-문제)
9. [성능 및 속도 문제](#9-성능-및-속도-문제)
10. [디버깅 팁](#10-디버깅-팁)

---

## 1. AI 모델 관련 문제

### 🔴 문제: AI가 SQL 대신 대화를 시작함

**증상**:
```
사용자: "개발팀 직원 보여줘"
AI 응답: "죄송합니다, 저는 인공지능 비서로서..."
```

**원인**:
- llama3.2:1b 같은 작은 모델 사용 중
- 시스템 프롬프트를 무시하고 일반 대화 모드로 작동

**해결방법**:
```bash
# 1. 현재 사용 중인 모델 확인
docker exec ttsql-app ollama list

# 2. ttsql-model이 qwen2.5-coder:7b 기반인지 확인
# 만약 llama3.2:1b 기반이면 재생성 필요

# 3. qwen2.5-coder:7b 다운로드 (없는 경우)
docker exec ttsql-app ollama pull qwen2.5-coder:7b

# 4. Modelfile이 올바른지 확인
docker exec ttsql-app cat /app/Modelfile | grep "FROM"
# 출력: FROM qwen2.5-coder:7b

# 5. 모델 재생성
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"

# 6. 컨테이너 재시작
docker-compose restart

# 7. 테스트
curl -X POST http://localhost:8787/api/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"userQuery":"급여가 높은 직원 3명"}'
```

**예상 결과**: SQL 쿼리만 반환되어야 함

---

### 🔴 문제: Position Filter 버그 (가장 중요!)

**증상**:
```sql
-- 사용자 질문: "개발본부 직원들 보여줘"
-- 잘못된 SQL:
SELECT e.name, e.salary, d.name as department
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE d.name LIKE '%개발%'
AND e.position IN ('부장', '임원', '대표이사');  -- ❌ 불필요한 조건!
```

**원인**:
- AI 모델이 암묵적으로 직급 필터 추가
- 시스템 프롬프트가 충분히 명확하지 않음
- 또는 오래된 모델 사용 중

**해결방법**:

**1단계: Modelfile 확인**
```bash
docker exec ttsql-app cat /app/Modelfile | grep -A 5 "Department Name Pattern"
```

**확인 사항**:
```modelfile
3. **Department Name Pattern Matching** (CRITICAL!):
   - ❌ NEVER NEVER NEVER add position filters (부장, 임원) unless user EXPLICITLY mentions job positions!
   - "개발본부 직원" = ALL employees, NO position filter
   - ONLY add position filter when user says "부장급", "임원", "과장 이상", etc.
```

**2단계: 예시 쿼리 확인**
```bash
docker exec ttsql-app cat /app/Modelfile | grep -A 2 "개발본부 직원"
```

**올바른 예시**:
```modelfile
Korean: "개발본부 직원들 보여줘"
SQL: SELECT e.name, e.salary, e.hire_date, d.name as department FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.name LIKE '%개발%';
```

**3단계: 모델 재생성 (필요시)**
```bash
# Modelfile 수정 후
docker cp Modelfile ttsql-app:/app/Modelfile
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"
docker-compose restart
```

**4단계: 테스트**
```bash
curl -X POST http://localhost:8787/api/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"userQuery":"개발본부 직원들 보여줘"}' | jq '.generatedSQL'
```

**정상 출력**:
```sql
SELECT e.name, e.salary, e.hire_date, d.name as department
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE d.name LIKE '%개발%';
```

---

### 🟡 문제: AI 응답이 너무 느림

**증상**: 쿼리 생성에 5초 이상 소요

**원인**:
- temperature, top_p, top_k 값이 너무 높음
- max_tokens가 너무 많음

**해결방법**:

**1. server.js 파라미터 확인**
```javascript
// server.js 파일에서 확인
temperature: 0.0,   // 낮을수록 빠름 (0.0 - 0.1)
top_p: 0.1,         // 낮을수록 빠름 (0.1 - 0.5)
top_k: 1,           // 낮을수록 빠름 (1 - 10)
max_tokens: 150     // SQL만 생성하므로 150으로 충분
```

**2. 수정 후 재시작**
```bash
docker cp server.js ttsql-app:/app/server.js
docker-compose restart
```

---

### 🟢 문제: "AI failed to generate valid SQL query" 에러

**증상**:
```json
{
  "success": false,
  "error": "AI failed to generate valid SQL query"
}
```

**원인**: AI가 SELECT로 시작하지 않는 응답 반환

**해결방법**:

**1. 실제 AI 응답 확인**
```bash
# 컨테이너 로그 확인
docker-compose logs ttsql-app | tail -20
```

**2. Ollama API 직접 테스트**
```bash
docker exec ttsql-app curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ttsql-model:latest",
    "messages": [
      {"role": "user", "content": "급여가 높은 직원 3명"}
    ],
    "max_tokens": 150,
    "temperature": 0.0
  }' | jq '.choices[0].message.content'
```

**3. 모델 재생성 (응답이 이상한 경우)**
```bash
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"
docker-compose restart
```

---

## 2. Docker 컨테이너 문제

### 🟡 문제: 컨테이너가 시작되지 않음

**증상**:
```bash
docker-compose up -d
# Error: Cannot start service ttsql
```

**진단 및 해결**:

**1. 포트 충돌 확인**
```bash
# Windows
netstat -ano | findstr "8787"
netstat -ano | findstr "11434"

# 프로세스 종료
taskkill /PID [PID번호] /F
```

**2. 이전 컨테이너 정리**
```bash
docker-compose down
docker ps -a | grep ttsql
docker rm -f ttsql-app
docker-compose up -d
```

**3. 이미지 재빌드**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**4. 로그 확인**
```bash
docker-compose logs ttsql-app
```

---

### 🟢 문제: 컨테이너는 실행 중이나 unhealthy 상태

**증상**:
```bash
docker-compose ps
# STATUS: Up (unhealthy)
```

**해결방법**:

**1. 헬스체크 로그 확인**
```bash
docker inspect ttsql-app | jq '.[0].State.Health'
```

**2. 수동으로 헬스체크 실행**
```bash
docker exec ttsql-app curl -s http://localhost:8787/api/test
```

**3. 서비스 재시작**
```bash
docker-compose restart
# 30초 대기 후 상태 확인
docker-compose ps
```

---

### 🔴 문제: Ollama 모델이 로드되지 않음

**증상**:
```bash
docker exec ttsql-app ollama list
# Empty list or error
```

**해결방법**:

**1. Ollama 서비스 상태 확인**
```bash
docker exec ttsql-app ps aux | grep ollama
```

**2. Ollama 수동 시작**
```bash
docker exec -d ttsql-app ollama serve
```

**3. 모델 재다운로드**
```bash
docker exec ttsql-app ollama pull qwen2.5-coder:7b
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"
```

**4. 컨테이너 재시작**
```bash
docker-compose restart
```

---

## 3. 데이터베이스 문제

### 🟡 문제: "no such table: employees" 에러

**증상**:
```json
{
  "success": false,
  "error": "no such table: employees"
}
```

**해결방법**:

**1. 데이터베이스 파일 존재 확인**
```bash
docker exec ttsql-app ls -lh /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/
```

**2. 테이블 목록 확인**
```bash
docker exec ttsql-app sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite ".tables"
```

**3. 스키마 재생성 (테이블이 없는 경우)**
```bash
# 호스트에서 스키마 파일 컨테이너로 복사
docker cp schema-v2-enterprise.sql ttsql-app:/app/

# 스키마 실행
docker exec ttsql-app sh -c "sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite < /app/schema-v2-enterprise.sql"

# 샘플 데이터 삽입 (선택)
docker cp seed-v2-enterprise.sql ttsql-app:/app/
docker exec ttsql-app sh -c "sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite < /app/seed-v2-enterprise.sql"
```

---

### 🟢 문제: 조회 결과가 0건

**증상**: SQL은 정상이나 데이터가 없음

**진단**:

**1. 테이블에 데이터가 있는지 확인**
```bash
docker exec ttsql-app sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite "SELECT COUNT(*) FROM employees;"
```

**2. 특정 부서 데이터 확인**
```bash
docker exec ttsql-app sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite "SELECT DISTINCT name FROM departments;"
```

**3. 샘플 데이터 재삽입**
```bash
docker exec ttsql-app sh -c "sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite < /app/seed-v2-enterprise.sql"
```

---

### 🔴 문제: "database is locked" 에러

**증상**:
```
Error: database is locked
```

**원인**: 동시 쓰기 작업 또는 파일 권한 문제

**해결방법**:

**1. 진행 중인 연결 확인**
```bash
docker exec ttsql-app sh -c "lsof /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite"
```

**2. 컨테이너 재시작**
```bash
docker-compose restart
```

**3. 권한 확인 및 수정**
```bash
docker exec ttsql-app chmod 666 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
```

---

## 4. API 연결 문제

### 🟢 문제: "Failed to fetch" 에러

**증상**: 브라우저 콘솔에 "Failed to fetch" 표시

**진단 순서**:

**1. 서버 응답 확인**
```bash
curl http://localhost:8787/api/test
```

**2. CORS 설정 확인**
```bash
curl -I http://localhost:8787/api/test
# Access-Control-Allow-Origin 헤더 확인
```

**3. 방화벽 확인**
```bash
# Windows Defender 방화벽에서 8787 포트 허용 확인
```

**해결방법**:
```bash
# 컨테이너 재시작
docker-compose restart

# 로그 확인
docker-compose logs -f ttsql-app
```

---

### 🟡 문제: "Ollama API error: 500" 에러

**증상**:
```json
{
  "success": false,
  "error": "Ollama API error: 500"
}
```

**해결방법**:

**1. Ollama 서비스 확인**
```bash
docker exec ttsql-app curl http://localhost:11434/api/tags
```

**2. Ollama 재시작**
```bash
docker exec ttsql-app pkill ollama
docker exec -d ttsql-app ollama serve
# 10초 대기
docker exec ttsql-app curl http://localhost:11434/api/tags
```

**3. 모델 재로드**
```bash
docker exec ttsql-app ollama list
docker exec ttsql-app ollama run ttsql-model:latest "test"
```

---

## 5. CORS 및 네트워크 문제

### 🔴 문제: CORS Policy 에러

**증상**:
```
Access to fetch at 'http://localhost:8787/api/generate-sql' has been blocked by CORS policy:
Request header field ngrok-skip-browser-warning is not allowed by Access-Control-Allow-Headers
```

**해결방법**:

**1. server.js CORS 설정 확인**
```javascript
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],  // 이 줄 확인!
  credentials: false
}));
```

**2. 수정 후 재배포**
```bash
docker cp server.js ttsql-app:/app/server.js
docker-compose restart
```

**3. 테스트**
```bash
curl -X POST http://localhost:8787/api/generate-sql \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"userQuery":"테스트"}'
```

---

## 6. SQL 생성 오류

### 🟡 문제: SQLite 문법 오류 - YEAR() 함수

**증상**:
```sql
-- 잘못된 SQL:
SELECT name FROM employees WHERE YEAR(hire_date) = 2023;
-- Error: no such function: YEAR
```

**원인**: SQLite는 `YEAR()`, `MONTH()`, `DAY()` 함수 미지원

**해결방법**:

**1. Modelfile에 명시 확인**
```modelfile
3. **SQLite-Specific Date Functions** (CRITICAL):
   - ❌ NEVER use: YEAR(), MONTH(), DAY()
   - ✅ ALWAYS use: strftime() function
   - Year: strftime('%Y', hire_date)
```

**2. 예시 추가**
```modelfile
Korean: "2023년에 입사한 직원들"
SQL: SELECT e.name, d.name as department, e.hire_date FROM employees e LEFT JOIN departments d ON e.department_id = d.id WHERE strftime('%Y', e.hire_date) = '2023';
```

**3. 모델 재생성**
```bash
docker cp Modelfile ttsql-app:/app/Modelfile
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"
```

---

### 🟢 문제: 한국어 통화 단위 변환 오류

**증상**:
```
사용자: "급여가 5천만원 이상인 직원"
잘못된 SQL: WHERE salary >= 5000000  -- ❌ 0이 하나 부족!
올바른 SQL: WHERE salary >= 50000000  -- ✅ 5천만 = 50,000,000
```

**해결방법**:

**Modelfile에 명확한 변환표 추가**
```modelfile
2. **Korean Currency Conversion** (CRITICAL):
   - 1만원 = 10000 (four zeros)
   - 100만원 = 1000000 (six zeros)
   - 1천만원 = 10000000 (seven zeros)
   - 5천만원 = 50000000 (EXACTLY 50 followed by six zeros)
   - 1억 = 100000000 (eight zeros)
   - FORMULA: X천만원 = X * 10000000
```

---

### 🟡 문제: JOIN 누락

**증상**:
```sql
-- 잘못된 SQL (부서명 조회 불가):
SELECT name, department FROM employees WHERE department = '개발팀';

-- 올바른 SQL:
SELECT e.name, d.name as department FROM employees e JOIN departments d ON e.department_id = d.id WHERE d.name LIKE '%개발%';
```

**해결방법**:

**Modelfile에 JOIN 필수 명시**
```modelfile
2. **ALWAYS USE JOIN for Department Queries** (MOST IMPORTANT!):
   - ❌ WRONG: SELECT name, department FROM employees
   - ✅ CORRECT: SELECT e.name, d.name as department FROM employees e JOIN departments d ON e.department_id = d.id
```

---

## 7. UI/Frontend 문제

### 🟢 문제: 이미지가 깨져서 표시됨

**증상**: IBK 로고, 마스코트 이미지가 broken image로 표시

**해결방법**:

**1. 이미지 파일 확인**
```bash
docker exec ttsql-app ls -lh /app/images/
```

**2. Dockerfile 확인**
```dockerfile
COPY images/ ./images/
```

**3. 재빌드**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

### 🟢 문제: 예시 버튼 클릭 시 반응 없음

**진단**:

**1. 브라우저 콘솔 확인**
```
F12 → Console 탭에서 에러 확인
```

**2. 네트워크 탭 확인**
```
F12 → Network 탭 → 클릭 시 요청 발생 확인
```

**3. index.html 함수 확인**
```javascript
function useExample(query) {
    document.getElementById('userInput').value = query;
    generateSQL();  // 이 함수가 정의되어 있는지 확인
}
```

---

## 8. ngrok 관련 문제

### 🟡 문제: ngrok 경고 페이지가 계속 표시됨

**증상**: "You are about to visit..." 경고 페이지

**해결방법**:

**1. index.html meta 태그 확인**
```html
<head>
  <meta name="ngrok-skip-browser-warning" content="true">
  ...
</head>
```

**2. api.js 헤더 확인**
```javascript
headers: {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true'  // 이 줄 필수!
}
```

**3. server.js CORS 설정 확인**
```javascript
allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning']
```

**4. 캐시 클리어**
```
Ctrl + Shift + Delete → 캐시 삭제 → 페이지 새로고침
```

---

### 🟢 문제: ngrok URL이 변경됨

**증상**: 이전 ngrok URL이 작동하지 않음

**원인**: ngrok 무료 플랜은 재시작 시 URL 변경

**해결방법**:

**1. 새 URL 확인**
```bash
# ngrok 실행 중인 터미널에서 URL 확인
# 또는
curl http://localhost:4040/api/tunnels
```

**2. config.js 업데이트 (선택)**
```javascript
WORKER_URL: '', // 상대 경로 유지 (ngrok URL 변경 영향 없음)
```

---

## 9. 성능 및 속도 문제

### 🟡 문제: 쿼리 생성이 너무 느림 (5초 이상)

**해결방법**:

**1. Temperature 낮추기**
```javascript
// server.js
temperature: 0.0,  // 0.0으로 설정 (기존 0.1 이하)
```

**2. max_tokens 줄이기**
```javascript
max_tokens: 100,  // 150 → 100
```

**3. 컨테이너 리소스 확인**
```bash
docker stats ttsql-app
# CPU, Memory 사용량 확인
```

**4. Ollama 프로세스 확인**
```bash
docker exec ttsql-app ps aux | grep ollama
```

---

### 🟢 문제: 브라우저가 느림

**해결방법**:

**1. 결과 제한 추가**
```sql
-- 대량 데이터 조회 시 LIMIT 추가
SELECT * FROM employees LIMIT 100;
```

**2. 브라우저 캐시 클리어**

**3. 다른 브라우저 테스트**
```
Chrome, Firefox, Edge 순서로 테스트
```

---

## 10. 디버깅 팁

### 실시간 로그 모니터링
```bash
# 전체 로그
docker-compose logs -f

# 마지막 100줄
docker-compose logs --tail=100 ttsql-app

# 특정 키워드 필터링
docker-compose logs ttsql-app | grep "ERROR"
```

### API 요청/응답 확인
```bash
# 상세 로그 활성화 (server.js에 추가)
console.log('📝 User query:', userQuery);
console.log('✅ Generated SQL:', sql);
console.log('📊 Results:', results.length, 'rows');
```

### 데이터베이스 직접 쿼리
```bash
# SQLite 콘솔 진입
docker exec -it ttsql-app sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite

# 쿼리 실행
sqlite> SELECT * FROM employees LIMIT 5;
sqlite> .exit
```

### Ollama 직접 테스트
```bash
# 모델에 직접 질문
docker exec ttsql-app ollama run ttsql-model:latest "급여가 높은 직원 3명"
```

### 네트워크 진단
```bash
# 포트 리스닝 확인
docker exec ttsql-app netstat -tuln | grep -E '8787|11434'

# 컨테이너 간 통신 테스트
docker exec ttsql-app curl http://localhost:8787/api/test
docker exec ttsql-app curl http://localhost:11434/api/tags
```

---

## 긴급 복구 절차

### 전체 시스템 재설정 (최후의 수단)

```bash
# 1. 모든 컨테이너 중지 및 삭제
docker-compose down -v

# 2. 이미지 삭제
docker rmi $(docker images | grep ttsql | awk '{print $3}')

# 3. 재빌드
docker-compose build --no-cache

# 4. 시작
docker-compose up -d

# 5. Ollama 모델 재설치
docker exec ttsql-app ollama pull qwen2.5-coder:7b
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"

# 6. 데이터베이스 재생성 (필요시)
docker exec ttsql-app sh -c "sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite < /app/schema-v2-enterprise.sql"
docker exec ttsql-app sh -c "sqlite3 /app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite < /app/seed-v2-enterprise.sql"

# 7. 상태 확인
docker-compose ps
curl http://localhost:8787/api/test
```

---

## 자주 묻는 질문 (FAQ)

### Q1: 모델 변경 후에도 문제가 지속됨
**A**: 브라우저 캐시 때문일 수 있습니다. Ctrl + Shift + Delete로 캐시 삭제 후 재시도하세요.

### Q2: 특정 쿼리만 계속 실패함
**A**: Modelfile에 해당 쿼리의 정확한 예시를 추가하고 모델을 재생성하세요.

### Q3: 컨테이너 재시작 후 모델이 사라짐
**A**: docker-compose.yml에 volume 설정이 빠졌거나, 모델이 제대로 생성되지 않았습니다. `ollama list`로 확인하고 재생성하세요.

### Q4: Windows에서 경로 문제 발생
**A**: Windows 경로는 역슬래시(`\`)를 사용하지만, Docker는 슬래시(`/`)를 사용합니다. 경로를 `/app/...` 형식으로 변경하세요.

---

## 지원 및 문의

문제가 해결되지 않는 경우:

1. **GitHub Issues**: 문제를 상세히 기록하여 이슈 등록
2. **로그 첨부**: `docker-compose logs` 출력 포함
3. **환경 정보**: OS, Docker 버전, 메모리 크기 등 명시

---

**문서 작성일**: 2025-10-15
**작성자**: Claude (Sonnet 4.5)
**기반**: 실제 개발 과정에서 발생한 모든 오류 및 해결 방법
