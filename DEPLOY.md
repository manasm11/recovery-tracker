# Deploying Recovery Tracker

The app ships as a **single Docker container**: the FastAPI backend serves the
built React frontend, so there is only one service and one port (8000) to host.

This build has been verified locally (`docker build` + `docker run`).

## 1. Build & run with Docker

From the repository root:

```bash
docker build -t recovery-tracker .

docker run -d --name recovery-tracker \
  -p 8000:8000 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e SEED_PASSWORD="<employee-password>" \
  -e SEED_ADMIN_PASSWORD="<admin-password>" \
  -v recovery_data:/app/data \
  -e DATABASE_URL="sqlite:////app/data/recovery.db" \
  recovery-tracker
```

The app is then available at http://localhost:8000.

> The `-v recovery_data:/app/data` volume + `DATABASE_URL` keep your data across
> restarts when using SQLite. For higher reliability use managed Postgres
> (next section).

## 2. Environment variables

| Variable                      | Purpose                                          | Recommended                                  |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------- |
| `JWT_SECRET`                  | Signs login tokens                               | A long random string (`openssl rand -hex 32`)|
| `DATABASE_URL`                | Database connection                              | Postgres in prod (see below)                 |
| `SEED_USERNAME` / `SEED_PASSWORD`             | Employee account created on first boot | Set a real password               |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | Owner/admin account             | Set a real password                          |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session length                                   | `10080` (7 days)                             |
| `CORS_ORIGINS`                | Allowed origins (only needed if hosting the API and UI on different domains) | `*` for single-domain |

Using Postgres:

```
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME
```

## 3. Hosting options

Any host that can run a Docker container works. Common choices:

- **Render / Railway / Fly.io** — point them at this repo, they build the
  `Dockerfile`, set the env vars above, and give you an HTTPS URL.
- **A VPS** (e.g. DigitalOcean, Hetzner) — install Docker and run the commands
  in section 1 behind a reverse proxy (Caddy/Nginx) for TLS.

## 4. Pointing recovery.durgadawaghar.com at it

Once deployed you will get either a hostname (e.g. `myapp.onrender.com`) or an
IP address.

- If your host gives a **hostname**, add a DNS **CNAME** record:
  - Name/Host: `recovery`
  - Value/Target: the host's domain (e.g. `myapp.onrender.com`)
- If your host gives an **IP address**, add a DNS **A** record:
  - Name/Host: `recovery`
  - Value: the IP address

Then enable HTTPS for `recovery.durgadawaghar.com` (most managed hosts do this
automatically once the domain is added in their dashboard; on a VPS use Caddy or
Certbot).

## 5. First login

Use the seeded admin/employee accounts from the env vars above. There is no
self-service password reset yet, so keep these credentials safe. Changing a
password means updating the value in the database (or re-seeding a fresh DB).
