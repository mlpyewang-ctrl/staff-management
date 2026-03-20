#!/bin/sh
set -e

if [ "${RUN_DB_PUSH:-true}" = "true" ]; then
  echo "[entrypoint] running prisma db push..."
  npx prisma db push
fi

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "[entrypoint] running prisma seed..."
  npm run db:seed
fi

exec "$@"
