from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_same_origin_spa_preserves_api_and_missing_asset_errors(tmp_path: Path):
    (tmp_path / "index.html").write_text("<html>Second Table shell</html>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets/app.js").write_text('console.log("built");')
    settings = Settings(_env_file=None, postgres_password=None, static_dist=tmp_path)
    with TestClient(create_app(settings)) as client:
        assert "Second Table shell" in client.get("/dashboard").text
        assert client.get("/api/v1/health/live").json()["data"]["status"] == "alive"
        assert client.get("/api/v1/missing").status_code == 404
        assert client.get("/assets/missing.js").status_code == 404
        assert "console.log" in client.get("/assets/app.js").text
