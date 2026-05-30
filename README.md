# Recovery Tracker

A small web app for tracking customer recovery reminders for
**recovery.durgadawaghar.com**.

An employee logs in, sees the list of customers they need to call **today**
(plus anyone overdue), and records each call: the reminder date, what the
customer said, and the next date the customer promised. The full reminder
history is kept per customer, and an admin can view overall progress.

## Features

- Simple username/password login (JWT based)
- Add customers manually (name + phone)
- Per-customer reminder log with full history:
  - reminder date
  - what the customer said (notes)
  - next promised date
- "Today" view: customers due today or overdue, most overdue first
- Admin progress dashboard with summary stats
- Search customers by name or phone

## Tech stack

| Layer    | Technology                                   |
| -------- | -------------------------------------------- |
| Frontend | React + TypeScript + Vite + Tailwind CSS     |
| Backend  | Python + FastAPI + SQLAlchemy                |
| Database | SQLite (dev) / PostgreSQL (production)        |
| Auth     | JWT (OAuth2 password flow)                    |

## Project structure

```
backend/    FastAPI app (API, models, auth)
frontend/   React + Vite single-page app
```

## Local development

### 1. Backend

```bash
cd backend
uv venv .venv && source .venv/bin/activate
uv pip install -e ".[dev]"
python -m app.seed          # create tables + seed users
uvicorn app.main:app --reload --port 8000
```

The API runs at http://127.0.0.1:8000 (docs at `/docs`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at http://127.0.0.1:5173 and proxies `/api` to the backend.

## Default accounts

Created on first backend startup (override via environment variables — see
`backend/.env.example`). **Change these in production.**

| Username   | Password      | Role     |
| ---------- | ------------- | -------- |
| `employee` | `changeme123` | employee |
| `admin`    | `changeme123` | admin    |

## Configuration

See `backend/.env.example` and `frontend/.env.example`. Key variables:

- `DATABASE_URL` — Postgres connection string in production.
- `JWT_SECRET` — long random string; required for secure tokens.
- `SEED_*` — initial account credentials.
- `CORS_ORIGINS` — allowed frontend origin(s) in production.
- `VITE_API_URL` (frontend, build time) — deployed backend base URL.

## Linting

```bash
cd backend && ruff check .
cd frontend && npm run lint
```
