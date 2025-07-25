# 🔒 Git 보안 수정 안내

## ⚠️ 긴급 상황
현재 `config.js`와 `wrangler.toml` 파일에 민감정보가 포함되어 있고, 이미 Git 저장소에 추적되고 있습니다.

## 🛠 수정 방법

### 1단계: 보안 수정 스크립트 실행
```bash
fix-git-security.bat
```

### 2단계: 새로운 설정 파일 생성
```bash
# API 설정 파일 생성
copy config.example.js config.js

# Cloudflare 설정 파일 생성  
copy wrangler.example.toml wrangler.toml
```

### 3단계: 실제 값으로 설정
- `config.js`: OpenAI API 키 입력
- `wrangler.toml`: Cloudflare 계정 ID, 데이터베이스 ID 입력

## ✅ 수정 후 효과
- ✅ 민감정보 파일들이 Git에서 제외됨
- ✅ API 키가 서버 환경변수로 관리됨  
- ✅ 클라이언트에 API 키 노출되지 않음
- ✅ 템플릿 파일로 안전한 공유 가능

## 🔐 보안 개선사항
1. **API 키 보호**: 클라이언트 → 서버 환경변수로 이동
2. **Cloudflare 정보 보호**: account_id, database_id 숨김
3. **Git 추적 제외**: .gitignore로 민감파일 보호
4. **템플릿 제공**: 안전한 설정 가이드 제공