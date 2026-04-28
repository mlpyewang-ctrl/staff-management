#!/bin/bash
set -e

BUNDLE_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="${ENV_FILE:-$BUNDLE_DIR/.env.prod}"
APP_TAR="${APP_TAR:-$BUNDLE_DIR/images/app-image.tar}"

if [ ! -f "$ENV_FILE" ]; then
  echo "missing $ENV_FILE"
  echo "copy .env.prod.example to .env.prod and fill real values first"
  exit 1
fi

if [ ! -f "$APP_TAR" ]; then
  echo "app image tar is missing in $BUNDLE_DIR/images"
  exit 1
fi

# load env
set -a
source "$ENV_FILE"
set +a

echo "[1/3] load docker image"
docker load -i "$APP_TAR"

echo "[2/3] remove old container if exists"
docker rm -f staff-management-app 2>/dev/null || true

echo "[3/3] start app"
# NOTE: If the database is on the same host (non-docker),
# you may need to add network options so the container can reach it:
#   Linux Docker 20.10+: --add-host=host.docker.internal:host-gateway
#   Or use --network host
# If the database is on a separate server, ensure network connectivity.
docker run -d \
  --name staff-management-app \
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
docker ps --filter name=staff-management-app
