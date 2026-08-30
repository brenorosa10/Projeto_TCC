#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Crie o arquivo .env a partir do .env.example antes de publicar."
  exit 1
fi

if ! docker network inspect proxy >/dev/null 2>&1; then
  docker network create proxy
fi

git pull
docker compose up -d --build --remove-orphans
