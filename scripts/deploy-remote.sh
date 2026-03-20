#!/bin/sh
set -e

DEPLOY_PATH="${DEPLOY_PATH:-/opt/staff-management}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"

cd "$DEPLOY_PATH"

if [ ! -f "$ENV_FILE" ]; then
  echo "missing $ENV_FILE in $DEPLOY_PATH"
  exit 1
fi

export IMAGE_NAME="${IMAGE_NAME:-ghcr.io/your-org/staff-management}"
export IMAGE_TAG="${IMAGE_TAG:-latest}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed on target server"
  exit 1
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans
docker image prune -f
