#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "Copie .env.example para .env e preencha CERTBOT_EMAIL."
  exit 1
fi

# shellcheck disable=SC1091
source .env

if [[ -z "${CERTBOT_EMAIL:-}" ]]; then
  echo "CERTBOT_EMAIL vazio no .env"
  exit 1
fi

dummy() {
  local domain="$1"
  local dir="./letsencrypt/live/${domain}"
  mkdir -p "$dir"
  if [[ -f "${dir}/fullchain.pem" ]]; then
    return
  fi
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${dir}/privkey.pem" \
    -out "${dir}/fullchain.pem" \
    -subj "/CN=${domain}"
}

dummy astroarq.online
dummy scorehistory.tech

docker compose up -d nginx
sleep 2

rm -rf ./letsencrypt/live/astroarq.online ./letsencrypt/archive/astroarq.online ./letsencrypt/renewal/astroarq.online.conf
rm -rf ./letsencrypt/live/scorehistory.tech ./letsencrypt/archive/scorehistory.tech ./letsencrypt/renewal/scorehistory.tech.conf

docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email --non-interactive \
  -d astroarq.online -d www.astroarq.online

docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email --non-interactive \
  -d scorehistory.tech -d www.scorehistory.tech

docker compose exec nginx nginx -s reload
docker compose up -d certbot
echo "Certificados emitidos. Teste https://astroarq.online e https://scorehistory.tech"
