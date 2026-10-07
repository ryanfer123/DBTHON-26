import base64
import io

import pytest
from PIL import Image

from app.core.errors import DomainError
from app.workflows.photos import normalize


@pytest.mark.parametrize("value", ["", "%%%", "aGVsbG8=", "A" * 204804])
def test_invalid_thumbnails_rejected(value):
    with pytest.raises(DomainError):
        normalize(value)


def test_optional_photo_and_bounded_jpeg():
    assert normalize(None) is None
    buffer = io.BytesIO()
    Image.new("RGB", (1600, 800), "blue").save(buffer, "PNG")
    result = normalize(base64.b64encode(buffer.getvalue()).decode())
    assert result and len(result) < 153600
    with Image.open(io.BytesIO(result)) as image:
        assert image.size == (800, 400)
        assert image.format == "JPEG"
