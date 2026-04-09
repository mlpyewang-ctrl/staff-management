#!/bin/bash
set -e

BUNDLE_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="${ENV_FILE:-$BUNDLE_DIR/.env.prod}"
APP_TAR="${APP_TAR:-$BUNDLE_DIR/images/app-image.tar}"
POSTGRES_TAR="${POSTGRES_TAR:-$BUNDLE_DIR/images/postgres-image.tar}"

if [ ! -f "$ENV_FILE" ]; then
  echo "missing $ENV_FILE"
  echo "copy .env.prod.example to .env.prod and fill real values first"
  exit 1
fi

if [ ! -f "$APP_TAR" ] || [ ! -f "$POSTGRES_TAR" ]; then
  echo "image tar files are missing in $BUNDLE_DIR/images"
  exit 1
fi

# load env
set -a
source "$ENV_FILE"
set +a

echo "[1/5] load docker images"
docker load -i "$POSTGRES_TAR"
docker load -i "$APP_TAR"

echo "[2/5] prepare network and volume"
docker network inspect staff-management-net >/dev/null 2>&1 || docker network create staff-management-net
docker volume inspect staff-management-postgres-data >/dev/null 2>&1 || docker volume create staff-management-postgres-data

echo "[3/5] remove old containers if exist"
docker rm -f postgres staff-management-app 2>/dev/null || true

echo "[4/5] start postgres"
docker run -d \
  --name postgres \
  --network staff-management-net \
  -v staff-management-postgres-data:/var/lib/postgresql/data \
  -e POSTGRES_USER="${POSTGRES_USER}" \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  -e POSTGRES_DB="${POSTGRES_DB}" \
  -e TZ="${TZ:-Asia/Shanghai}" \
  -p "${POSTGRES_PORT:-5432}:5432" \
  --restart unless-stopped \
  "${POSTGRES_IMAGE:-postgres:16-alpine}"

echo "  waiting for postgres ready..."
until docker exec postgres pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; do
  sleep 1
done

echo "[5/5] start app"
docker run -d \
  --name staff-management-app \
  --network staff-management-net \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATABASE_URL="${DATABASE_URL}" \
  -e NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
  -e NEXTAUTH_URL="${NEXTAUTH_URL}" \
  -e RUN_DB_PUSH="${RUN_DB_PUSH:-true}" \
  -e RUN_DB_SEED="${RUN_DB_SEED:-false}" \
  -e TZ="${TZ:-Asia/Shanghai}" \
  -p "${APP_PORT:-3000}:3000" \
  --restart unless-stopped \
  "${IMAGE_NAME:-staff-management-app}:${IMAGE_TAG:-offline}"

echo "========================================"
echo "  Deployment complete"
echo "  App: http://localhost:${APP_PORT:-3000}"
echo "========================================"
docker ps --filter name=staff-management --filter name=postgres
