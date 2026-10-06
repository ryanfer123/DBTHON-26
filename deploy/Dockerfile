FROM node:22.19.0-alpine AS web
WORKDIR /build
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.12.18-python3.13-trixie-slim AS api
WORKDIR /app
COPY apps/api/pyproject.toml apps/api/uv.lock /app/apps/api/
RUN uv sync --project apps/api --frozen --no-dev --no-editable

FROM python:3.13-slim-trixie
WORKDIR /app
COPY --from=api /app/apps/api/.venv /app/apps/api/.venv
COPY apps/api/app /app/apps/api/app
COPY scripts/worker.py scripts/serve.py /app/scripts/
COPY --from=web /build/dist /app/web
ENV PATH="/app/apps/api/.venv/bin:$PATH" PYTHONPATH=/app/apps/api STATIC_DIST=/app/web SESSION_SAME_SITE=lax PYTHONUNBUFFERED=1
RUN useradd --uid 10001 --create-home app
USER 10001
EXPOSE 8000
CMD ["python", "scripts/serve.py"]
