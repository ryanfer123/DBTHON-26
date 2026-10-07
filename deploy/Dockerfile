FROM node:22.19.0-alpine AS web
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.12.18-python3.13-trixie-slim AS api
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock /app/backend/
RUN uv sync --project backend --frozen --no-dev --no-editable

FROM python:3.13-slim-trixie
WORKDIR /app
COPY --from=api /app/backend/.venv /app/backend/.venv
COPY backend/app /app/backend/app
COPY scripts/worker.py scripts/serve.py /app/scripts/
COPY --from=web /build/dist /app/web
ENV PATH="/app/backend/.venv/bin:$PATH" PYTHONPATH=/app/backend STATIC_DIST=/app/web SESSION_SAME_SITE=lax PYTHONUNBUFFERED=1
RUN useradd --uid 10001 --create-home app
USER 10001
EXPOSE 8000
CMD ["python", "scripts/serve.py"]
