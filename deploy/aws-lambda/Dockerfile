FROM ghcr.io/astral-sh/uv:0.12.18-python3.13-trixie-slim AS lock
WORKDIR /build
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv export --frozen --no-dev --no-emit-project -o requirements.txt

FROM public.ecr.aws/lambda/python:3.13 AS package
COPY --from=lock /build/requirements.txt /tmp/requirements.txt
RUN pip install --require-hashes -r /tmp/requirements.txt --target /package
COPY apps/api/app /package/apps/api/app
COPY apps/api/alembic /package/apps/api/alembic
COPY apps/api/alembic.ini /package/apps/api/alembic.ini
COPY database /package/database
COPY data/fixtures /package/data/fixtures
COPY scripts/prepare_cloud_database.py /package/scripts/prepare_cloud_database.py
COPY deploy/aws-lambda/bootstrap.py /package/bootstrap.py
ENV PYTHONPATH=/package/apps/api
