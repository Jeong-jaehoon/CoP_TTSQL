# TTSQL 배포 가이드

한국어 자연어를 SQL로 변환하는 AI 기반 Text-to-SQL 애플리케이션 배포 가이드입니다.

## 🤖 사용 기술

- **AI 모델**: Qwen 2.5 Coder 7B (via Ollama)
- **백엔드**: Node.js + Express
- **데이터베이스**: SQLite
- **컨테이너**: Docker + Docker Compose

## 시스템 요구사항

- Docker 20.10 이상
- Docker Compose 1.29 이상
- **최소 4GB RAM (권장: 8GB)** - AI 모델 실행에 필요
- 최소 10GB 디스크 공간 (Qwen 모델 ~5GB 포함)

## 빠른 시작 (로컬 환경)

### 1. Docker로 빌드 및 실행

```bash
# 프로젝트 디렉토리로 이동
cd CoP_TTSQL

# Docker Compose로 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 2. 애플리케이션 접속

- 웹 인터페이스: http://localhost:8787
- Ollama API: http://localhost:11434

### 3. 중지 및 재시작

```bash
# 중지
docker-compose down

# 재시작
docker-compose restart

# 데이터 포함 완전 삭제
docker-compose down -v
```

## 클라우드 서버 배포

### AWS EC2 배포

#### 1. EC2 인스턴스 생성
- **인스턴스 타입**: t3.large 권장 (2 vCPU, 8GB RAM) - Qwen 모델 실행에 필요
- **최소 사양**: t3.medium (2 vCPU, 4GB RAM) - 성능 저하 가능
- **OS**: Ubuntu 22.04 LTS
- **스토리지**: 30GB 이상 (Qwen 모델 포함)
- **보안 그룹**: 포트 8787, 11434 오픈

#### 2. Docker 설치

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose 설치
sudo apt install docker-compose -y

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
newgrp docker
```

#### 3. 애플리케이션 배포

```bash
# 프로젝트 파일 업로드 (또는 Git clone)
scp -r CoP_TTSQL ubuntu@YOUR_EC2_IP:~/

# SSH 접속
ssh ubuntu@YOUR_EC2_IP

# 프로젝트 디렉토리로 이동
cd CoP_TTSQL

# Docker Compose로 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

#### 4. 도메인 연결 (선택사항)

Nginx를 사용한 리버스 프록시 설정:

```bash
# Nginx 설치
sudo apt install nginx -y

# Nginx 설정 파일 생성
sudo nano /etc/nginx/sites-available/ttsql
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/ttsql /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Google Cloud Platform (GCP) 배포

#### 1. GCE 인스턴스 생성

```bash
# gcloud CLI 설치 후
gcloud compute instances create ttsql-instance \
    --machine-type=e2-medium \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=20GB \
    --tags=http-server,https-server
```

#### 2. 방화벽 규칙 추가

```bash
gcloud compute firewall-rules create allow-ttsql \
    --allow=tcp:8787,tcp:11434 \
    --target-tags=http-server
```

나머지 배포 과정은 AWS EC2와 동일합니다.

### DigitalOcean Droplet 배포

#### 1. Droplet 생성
- **Plan**: Basic ($12/month - 2GB RAM)
- **OS**: Ubuntu 22.04
- **Datacenter**: 가장 가까운 지역 선택

#### 2. SSH 접속 및 배포

```bash
ssh root@YOUR_DROPLET_IP

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 프로젝트 업로드 및 실행 (AWS EC2와 동일)
```

## Docker Hub에 이미지 배포

### 1. Docker Hub 로그인

```bash
docker login
```

### 2. 이미지 빌드 및 푸시

```bash
# 이미지 빌드
docker build -t your-dockerhub-username/ttsql:latest .

# Docker Hub에 푸시
docker push your-dockerhub-username/ttsql:latest
```

### 3. 다른 서버에서 사용

```bash
# docker-compose.yml 수정
# image: your-dockerhub-username/ttsql:latest 로 변경

docker-compose up -d
```

## 환경 변수 설정

필요시 `docker-compose.yml`에서 환경 변수를 수정하세요:

```yaml
environment:
  - NODE_ENV=production
  - PORT=8787
  - OLLAMA_HOST=http://localhost:11434
```

## 데이터 백업

데이터베이스와 Ollama 모델은 Docker 볼륨에 저장됩니다:

```bash
# 볼륨 확인
docker volume ls

# 백업
docker run --rm -v ttsql_ttsql-data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/ttsql-backup.tar.gz /data

# 복원
docker run --rm -v ttsql_ttsql-data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/ttsql-backup.tar.gz -C /
```

## 문제 해결

### Qwen 모델 로딩 실패

```bash
# 컨테이너 내부로 들어가기
docker exec -it ttsql-app bash

# Ollama 상태 확인
ollama list

# 수동으로 Qwen 모델 다운로드
ollama pull qwen2.5-coder:7b

# 커스텀 모델 생성
ollama create ttsql-model -f Modelfile

# 테스트
ollama run qwen2.5-coder:7b "SELECT * FROM employees;"
```

### 데이터베이스 초기화 실패

```bash
# 컨테이너 로그 확인
docker-compose logs ttsql

# 볼륨 삭제 후 재생성
docker-compose down -v
docker-compose up -d
```

### 메모리 부족

docker-compose.yml에 메모리 제한 추가:

```yaml
services:
  ttsql:
    # ... 기존 설정
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
```

## 성능 최적화

### 1. Qwen 모델 성능 조정

`Modelfile`에서 파라미터 조정:

```
PARAMETER num_ctx 4096  # 컨텍스트 크기 증가
PARAMETER num_gpu 1     # GPU 사용 (가능한 경우)
PARAMETER temperature 0.1  # 낮을수록 일관성 높음
```

서버 코드에서 max_tokens 조정 (server.js:109):
```javascript
max_tokens: 200,  # SQL 쿼리는 짧으므로 낮게 설정
temperature: 0.1  # 정확한 SQL 생성을 위해 낮게
```

### 2. 첫 실행 최적화

첫 실행 시 Qwen 모델이 자동으로 다운로드됩니다:
- 모델 크기: ~5GB
- 다운로드 시간: 네트워크 속도에 따라 5-15분
- 로그에서 진행 상황 확인: `docker-compose logs -f`

### 3. Node.js 클러스터링

`server.js`에 클러스터 모드 추가 (멀티 코어 활용) - 선택사항

## 모니터링

### Docker 상태 확인

```bash
# 컨테이너 상태
docker-compose ps

# 리소스 사용량
docker stats

# 로그
docker-compose logs -f --tail=100
```

### 헬스체크

애플리케이션 상태 확인:

```bash
curl http://localhost:8787/api/test
```

## 보안 권장사항

1. **방화벽 설정**: 필요한 포트만 오픈
2. **HTTPS 적용**: Let's Encrypt로 SSL 인증서 설치
3. **환경 변수**: 민감한 정보는 환경 변수로 관리
4. **정기 업데이트**: Docker 이미지 및 시스템 패키지 업데이트

## 라이선스

MIT License

## 지원

문제가 발생하면 GitHub Issues에 제보해주세요.
