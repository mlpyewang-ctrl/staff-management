#!/bin/sh
set -e

BUNDLE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="${ENV_FILE:-$BUNDLE_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$BUNDLE_DIR/docker-compose.prod.yml}"
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

echo "[1/3] load docker images"
docker load -i "$POSTGRES_TAR"
docker load -i "$APP_TAR"

echo "[2/3] start services"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "[3/3] done"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
