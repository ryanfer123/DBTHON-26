FROM ghcr.io/astral-sh/uv:0.12.18-python3.13-trixie-slim AS lock
WORKDIR /build
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv export --frozen --no-dev --no-emit-project -o requirements.txt

FROM public.ecr.aws/lambda/python:3.13 AS package
COPY --from=lock /build/requirements.txt /tmp/requirements.txt
RUN pip install --require-hashes -r /tmp/requirements.txt --target /package
COPY backend/app /package/backend/app
COPY backend/alembic /package/backend/alembic
COPY backend/alembic.ini /package/backend/alembic.ini
COPY database /package/database
COPY data/fixtures /package/data/fixtures
COPY scripts/prepare_cloud_database.py /package/scripts/prepare_cloud_database.py
COPY deploy/aws-lambda/bootstrap.py /package/bootstrap.py
ENV PYTHONPATH=/package/backend
