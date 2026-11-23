#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
command -v docker >/dev/null || { echo 'ERROR: docker required' >&2; exit 2; }
command -v npm >/dev/null || { echo 'ERROR: npm required' >&2; exit 2; }
[[ -f spike/package-lock.json ]] || { echo 'ERROR: authentic spike/package-lock.json required; npm ci will not be replaced with npm install' >&2; exit 2; }
trap 'docker compose -f infra/docker-compose.yml down --volumes' EXIT
docker compose -f infra/docker-compose.yml up -d --wait
cd spike
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run build
npm run migrate
npm run migrate
BOOKCORE_MIN_TESTS=56 npm test
npm run reconcile
