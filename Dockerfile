# Multi-stage build: build the React frontend, then serve it from the FastAPI
# backend as a single container.

# 1. Build the frontend
FROM node:20-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin API: the backend serves the SPA, so /api works without a base URL.
RUN npm run build

# 2. Backend + bundled frontend
FROM python:3.12-slim AS backend
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY backend/pyproject.toml ./
COPY backend/app ./app
COPY backend/main.py ./
RUN pip install --upgrade pip && pip install .

# Bundle the built frontend so FastAPI can serve it.
COPY --from=frontend /frontend/dist ./static

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
