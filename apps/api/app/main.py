import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from time import perf_counter
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.core.access import Access
from app.core.config import Settings
from app.core.database import Database
from app.core.errors import (
    DomainError,
    database_error_handler,
    domain_error_handler,
    validation_error_handler,
)
from app.core.static import AppStaticFiles
from app.routes.identity import router as identity_router
from app.routes.public import router as public_router
from app.routes.workflows import router as workflow_router

http_logger = logging.getLogger("second_table.http")
http_logger.setLevel(logging.INFO)
if not http_logger.handlers:
    http_logger.addHandler(logging.StreamHandler())
http_logger.propagate = False


class HealthData(BaseModel):
    status: Literal["alive", "ready"]


class HealthResponse(BaseModel):
    data: HealthData


def create_app(
    settings: Settings | None = None, database: Database | None = None, access: Access | None = None
) -> FastAPI:
    configured = settings or Settings()
    db = database or Database(configured)
    permissions = access or Access(configured)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            db.close()
            permissions.close()

    application = FastAPI(
        title="Second Table API",
        description="Zone-based food redistribution, accounts, delivery and impact reporting.",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=configured.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "X-Requested-With",
            "X-CSRF-Token",
            "Idempotency-Key",
            "If-None-Match",
        ],
        expose_headers=["Retry-After", "X-Request-ID", "ETag"],
    )
    application.state.database = db
    application.state.access = permissions
    application.state.settings = configured
    application.add_exception_handler(DomainError, domain_error_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.add_exception_handler(SQLAlchemyError, database_error_handler)

    @application.middleware("http")
    async def request_id(request: Request, call_next: RequestResponseEndpoint) -> Response:
        request.state.request_id = uuid4().hex
        started = perf_counter()
        response = await call_next(request)
        http_logger.info(
            json.dumps(
                {
                    "event": "http_request",
                    "request_id": request.state.request_id,
                    "method": request.method,
                    "route": getattr(request.scope.get("route"), "path", "unmatched"),
                    "status": response.status_code,
                    "duration_ms": round((perf_counter() - started) * 1000, 2),
                }
            )
        )
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.url.path.startswith("/api/v1") and request.url.path not in (
            "/api/v1/community",
            "/api/v1/zones",
            "/api/v1/health/live",
            "/api/v1/health/ready",
        ):
            response.headers["Cache-Control"] = "private, no-store"
        return response

    @application.get("/api/v1/health/live", response_model=HealthResponse, tags=["Health"])
    def live() -> HealthResponse:
        return HealthResponse(data=HealthData(status="alive"))

    @application.get(
        "/api/v1/health/ready",
        response_model=HealthResponse,
        responses={503: {"description": "PostgreSQL/PostGIS unavailable"}},
        tags=["Health"],
    )
    def ready(request: Request) -> HealthResponse | JSONResponse:
        if not db.ready() or not permissions.ready():
            return JSONResponse(
                status_code=503,
                content={
                    "error": {
                        "code": "SERVICE_NOT_READY",
                        "message": "The service is temporarily unavailable.",
                        "details": {},
                    },
                    "request_id": request.state.request_id,
                },
                headers={"Retry-After": "5"},
            )
        return HealthResponse(data=HealthData(status="ready"))

    application.include_router(public_router, prefix="/api/v1")
    application.include_router(identity_router, prefix="/api/v1")
    application.include_router(workflow_router, prefix="/api/v1")
    if configured.static_dist is not None:
        application.mount("/", AppStaticFiles(configured.static_dist), name="web")
    return application


app = create_app()
