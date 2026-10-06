"""Serve the built SPA beside the API without swallowing API/asset errors."""

from pathlib import Path

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class AppStaticFiles(StaticFiles):
    def __init__(self, directory: Path):
        super().__init__(directory=directory, html=True)

    async def get_response(self, path: str, scope: Scope) -> Response:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404)
        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404 or "." in path.rsplit("/", 1)[-1]:
                raise
            return await super().get_response("index.html", scope)
