#!/bin/bash
set -e

echo "🚀 TTSQL Deployment Script"
echo "================================"

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 단계 표시 함수
step() {
    echo -e "\n${BLUE}==>${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# Docker 및 Docker Compose 확인
step "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    exit 1
fi
success "Docker is installed"

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
success "Docker Compose is installed"

# 기존 컨테이너 중지
step "Stopping existing containers..."
docker-compose down || true
success "Containers stopped"

# 이미지 빌드
step "Building Docker image..."
docker-compose build --no-cache
success "Image built successfully"

# 컨테이너 시작
step "Starting TTSQL application..."
docker-compose up -d
success "Application started"

# 헬스체크 대기
step "Waiting for application to be ready..."
sleep 10

# 컨테이너 상태 확인
if [ "$(docker inspect -f '{{.State.Running}}' ttsql-app)" = "true" ]; then
    success "Container is running"
else
    error "Container failed to start"
    docker-compose logs
    exit 1
fi

# API 테스트
step "Testing API endpoint..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8787/api/test > /dev/null; then
        success "API is responding"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for API... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    error "API failed to respond"
    docker-compose logs
    exit 1
fi

# 한글→SQL 테스트
step "Testing Korean to SQL conversion..."
RESPONSE=$(curl -s -X POST http://localhost:8787/api/generate-sql \
    -H "Content-Type: application/json" \
    -d '{"userQuery":"급여가 5천만원 이상인 직원"}')

if echo "$RESPONSE" | grep -q "success"; then
    success "Korean to SQL conversion is working"
else
    warning "Korean to SQL test returned unexpected response"
    echo "$RESPONSE"
fi

# 배포 완료
echo ""
echo "================================"
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "📍 Access points:"
echo "   - Web Interface: http://localhost:8787"
echo "   - Ollama API: http://localhost:11434"
echo ""
echo "📊 Useful commands:"
echo "   - View logs: docker-compose logs -f"
echo "   - Stop: docker-compose down"
echo "   - Restart: docker-compose restart"
echo "   - Status: docker-compose ps"
echo ""
