# TTSQL 프로젝트 개발 대화 기록

## 프로젝트 개요
- **프로젝트명**: IBK기업은행 X 뽑아조 - AI SQL Assistant (TTSQL)
- **기술스택**: Ollama AI, Docker, ngrok, Express.js, SQLite
- **배포 방식**: Docker + ngrok tunneling
- **주요 기능**: 자연어를 SQL 쿼리로 변환하여 데이터베이스 조회

## 주요 이슈 및 해결 과정

### 1. ngrok 경고 페이지 제거
**문제**: ngrok URL 접속 시 "You are about to visit..." 경고 페이지 표시

**해결방법**:
- `ngrok-skip-browser-warning` 헤더 추가
- 수정 파일:
  - `index.html`: `<meta name="ngrok-skip-browser-warning" content="true">` 추가
  - `api.js`: fetch 헤더에 `'ngrok-skip-browser-warning': 'true'` 추가
  - `server.js`: CORS allowedHeaders에 헤더 추가

### 2. 예시 쿼리 속도 개선
**문제**: 복잡한 예시 쿼리(부서별 평균 급여 등)가 너무 느림

**해결방법**:
예시 쿼리를 빠른 쿼리로 변경:
- "개발본부 직원 조회"
- "급여 상위 3명"
- "2023년 입사자"
- "부서별 직원 수"

### 3. 이미지 로딩 오류
**문제**: IBK 로고, 마스코트 이미지가 깨져서 표시됨

**해결방법**:
- Dockerfile에 `COPY images/ ./images/` 추가
- 컨테이너 재빌드

### 4. CORS 정책 오류
**문제**:
```
Access to fetch at 'http://localhost:8787/api/generate-sql' has been blocked by CORS policy:
Request header field ngrok-skip-browser-warning is not allowed by Access-Control-Allow-Headers
```

**해결방법**:
```javascript
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'],
  credentials: false
}));
```

### 5. AI 모델 SQL 생성 실패
**초기 문제**: AI가 "I can't help with that" 응답

**잘못된 접근**: Rule-based fallback 함수 추가
**사용자 피드백**: "아니 애초에 AI로 잘 작동을 하게끔 만들어야지"

**올바른 해결**: AI 모델 자체를 개선

### 6. Position Filter 버그 (가장 중요한 이슈)
**문제**:
사용자 질문: "부서가 '개발'로 시작하는 직원들 보여줘"
AI 생성 SQL:
```sql
SELECT e.name, e.salary, d.name as department
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE d.name LIKE '%개발%'
AND e.position IN ('부장', '임원', '대표이사');  -- 불필요한 조건!
```

**문제점**:
- 사용자가 직급 필터를 요청하지 않았는데 AI가 임의로 추가
- 여러 번 시도했지만 계속 position 조건이 추가됨

**해결 과정**:
1. **시도 1**: Rule-based 로직으로 패턴 매칭 → 사용자가 거부
2. **시도 2**: Modelfile에 명시적 예시 추가 → 여전히 발생
3. **시도 3**: 시스템 프롬프트 강화 → 여전히 발생
4. **최종 해결**:
   - 모델 변경: `llama3.2:1b` → `qwen2.5-coder:7b`
   - llama3.2:1b (1.3GB): 너무 작아서 시스템 프롬프트 무시, 대화 시작
   - qwen2.5-coder:7b (4.7GB): 코딩 특화 모델, 정확한 SQL 생성

**Modelfile 주요 수정사항**:
```modelfile
FROM qwen2.5-coder:7b

SYSTEM """
3. **Department Name Pattern Matching** (CRITICAL!):
   - Database uses "본부" naming: 개발본부, 경영지원본부, 사업본부, etc.
   - ❌ NEVER NEVER NEVER add position filters (부장, 임원) unless user EXPLICITLY mentions job positions!
   - "개발본부 직원" = ALL employees, NO position filter
   - "경영지원본부 직원" = ALL employees, NO position filter
   - ONLY add position filter when user says "부장급", "임원", "과장 이상", etc.
"""

PARAMETER temperature 0.01
PARAMETER top_p 0.5
PARAMETER top_k 10
```

**결과**:
사용자 피드백 - "오케이 너무 잘 작동한다"

### 7. UI 개선 사항

**테이블 목록 메뉴 추가**:
- Contact us 옆에 "테이블 목록" 버튼 추가
- 모달 창으로 10개 테이블 스키마 정보 표시
- 테이블: employees, departments, projects, project_members, salary_payments, attendance, leave_requests, performance_reviews, training_records, assets

**조회 결과 없음 메시지**:
```javascript
} else if (sql && data && data.length === 0) {
    const noResultDiv = document.createElement('div');
    noResultDiv.style.cssText = 'margin-top: 1rem; padding: 1rem; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; color: #856404; text-align: center;';
    noResultDiv.textContent = '📭 조회 결과가 없습니다';
    contentDiv.appendChild(noResultDiv);
}
```

## 기술 스택 상세

### AI 모델 변화
1. **llama3.2:1b** (초기)
   - 크기: 1.3GB
   - 문제점: 시스템 프롬프트 무시, SQL 대신 대화 시작, 불필요한 조건 추가
   - 예시: "죄송합니다, 저는 인공지능 비서로서..."

2. **qwen2.5-coder:7b** (최종)
   - 크기: 4.7GB
   - 장점: 코딩 특화 모델, 정확한 SQL 생성, 시스템 프롬프트 준수
   - 파라미터: temperature=0.01, top_p=0.5, top_k=10

### 데이터베이스 스키마
- **employees**: 직원 정보 (28 fields)
  - 주요 컬럼: id, name, department_id (FK), position, salary, hire_date
- **departments**: 부서 정보 (계층 구조)
  - 주요 컬럼: id, dept_code, name (개발본부, 경영지원본부 등), parent_dept_id
- **JOIN 필수**: 부서명 조회 시 반드시 employees와 departments JOIN

### 배포 환경
- **Docker**: Multi-stage build (Node.js + Ollama)
- **ngrok**: 외부 접근을 위한 터널링
- **포트**: 8787 (Express.js), 11434 (Ollama)

## 주요 학습 내용

### 1. AI 모델 크기의 중요성
- 1B 파라미터 모델은 복잡한 지시사항 따르기 어려움
- 7B 코딩 특화 모델이 SQL 생성에 훨씬 효과적

### 2. Rule-based vs AI-based
- 초기에 Rule-based fallback으로 해결하려 했으나 사용자가 거부
- **사용자 피드백**: "아니 애초에 AI로 잘 작동을 하게끔 만들어야지"
- AI 자체를 개선하는 것이 올바른 접근

### 3. 프롬프트 엔지니어링
- 단순히 "NEVER do X" 명령만으로는 부족
- 구체적인 예시 제공 필요
- 모델 능력이 받쳐주지 않으면 프롬프트도 소용없음

### 4. SQLite 특수성
- `YEAR()`, `MONTH()`, `DAY()` 함수 없음
- `strftime('%Y', hire_date)` 사용 필요
- String concatenation: `||` 연산자 사용

## 최종 작동 방식

1. 사용자가 자연어 질문 입력
2. `api.js`가 `/api/generate-sql` 엔드포인트 호출
3. `server.js`가 Ollama API 호출 (ttsql-model:latest)
4. qwen2.5-coder:7b 모델이 SQL 생성
5. 생성된 SQL을 SQLite DB에서 실행
6. 결과를 테이블 형태로 UI에 표시

## 개선 전후 비교

### Before (llama3.2:1b + Rule-based)
```
사용자: "개발본부 직원들 보여줘"
AI: "죄송합니다, 저는..." (대화 시작)
또는
AI: SELECT ... WHERE ... AND e.position IN ('부장', '임원') (잘못된 조건)
```

### After (qwen2.5-coder:7b)
```
사용자: "개발본부 직원들 보여줘"
AI: SELECT e.name, e.salary, e.hire_date, d.name as department
    FROM employees e
    JOIN departments d ON e.department_id = d.id
    WHERE d.name LIKE '%개발%';
```

## 배포 명령어 요약

### 모델 재생성
```bash
docker exec ttsql-app sh -c "cd /app && ollama create ttsql-model:latest -f Modelfile"
```

### 파일 업데이트 후 재시작
```bash
docker cp server.js ttsql-app:/app/server.js
docker cp Modelfile ttsql-app:/app/Modelfile
docker-compose restart
```

### 컨테이너 재빌드
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 사용자 최종 평가
**"오케이 너무 잘 작동한다"**

---

생성일: 2025-10-15
작성자: Claude (Sonnet 4.5)
프로젝트: IBK기업은행 X 뽑아조 - TTSQL
