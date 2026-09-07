# Nginx de borda

Cópia para `~/proxy` na VPS. Escuta 80/443 e encaminha:

- `astroarq.online` → `astro-frontend`
- `scorehistory.tech` → `scorehistory-frontend`

```bash
docker network create proxy
cp .env.example .env   # CERTBOT_EMAIL
./obter-certs.sh
```

Os dois projetos Docker precisam estar na rede `proxy` e **não** publicar 80/443.
