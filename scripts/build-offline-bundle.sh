#!/bin/sh
set -e

BUNDLE_DIR="${1:-.offline-bundle}"
APP_IMAGE="${APP_IMAGE:-staff-management-app:offline}"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TARGET_DIR="$ROOT_DIR/$BUNDLE_DIR/$TIMESTAMP"
IMAGES_DIR="$TARGET_DIR/images"
SCRIPTS_DIR="$TARGET_DIR/scripts"

mkdir -p "$IMAGES_DIR" "$SCRIPTS_DIR"

echo "[1/5] pull postgres image: $POSTGRES_IMAGE"
docker pull "$POSTGRES_IMAGE"

echo "[2/5] build app image: $APP_IMAGE"
docker build -t "$APP_IMAGE" "$ROOT_DIR"

echo "[3/5] save images"
docker save -o "$IMAGES_DIR/app-image.tar" "$APP_IMAGE"
docker save -o "$IMAGES_DIR/postgres-image.tar" "$POSTGRES_IMAGE"

echo "[4/5] copy deployment files"
cp "$ROOT_DIR/docker-compose.prod.yml" "$TARGET_DIR/docker-compose.prod.yml"
cp "$ROOT_DIR/.env.prod.example" "$TARGET_DIR/.env.prod.example"
cp "$ROOT_DIR/scripts/docker-entrypoint.sh" "$SCRIPTS_DIR/docker-entrypoint.sh"
cp "$ROOT_DIR/scripts/install-offline-bundle.sh" "$SCRIPTS_DIR/install-offline-bundle.sh"
cat > "$TARGET_DIR/bundle-info.txt" <<EOF
APP_IMAGE=$APP_IMAGE
POSTGRES_IMAGE=$POSTGRES_IMAGE
CREATED_AT=$(date -Iseconds)
BUNDLE_DIR=$TARGET_DIR
EOF

echo "[5/5] bundle ready: $TARGET_DIR"
echo "Copy this directory to the offline server, then run:"
echo "  cd $TARGET_DIR"
echo "  cp .env.prod.example .env.prod"
echo "  sh scripts/install-offline-bundle.sh"
