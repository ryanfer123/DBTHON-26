"""Normalize untrusted uploads to bounded JPEGs with no EXIF or location metadata."""

import base64
import binascii
import io
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import DomainError

MAX_BYTES = 153600


def normalize(encoded: str | None) -> bytes | None:
    if encoded is None:
        return None
    try:
        if len(encoded) > 204800:
            raise ValueError("Too large")
        raw = base64.b64decode(encoded, validate=True)
        if not 0 < len(raw) <= MAX_BYTES:
            raise ValueError("Too large")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as source:
                if (
                    source.format not in {"JPEG", "PNG", "WEBP"}
                    or source.width * source.height > 12_000_000
                ):
                    raise ValueError("Unsupported image")
                source.load()
                oriented = ImageOps.exif_transpose(source).convert("RGB")
                oriented.thumbnail((800, 800))
                # A fresh image carries no source info dictionary or metadata.
                clean = Image.new("RGB", oriented.size)
                clean.paste(oriented)
                for quality in (82, 70, 58, 40):
                    output = io.BytesIO()
                    clean.save(output, format="JPEG", quality=quality, optimize=True)
                    if output.tell() <= MAX_BYTES:
                        return output.getvalue()
                raise ValueError("Too large")
    except (
        ValueError,
        binascii.Error,
        OSError,
        UnidentifiedImageError,
        Image.DecompressionBombWarning,
        Image.DecompressionBombError,
    ):
        raise DomainError(
            "INVALID_PHOTO", 422, "Use a JPEG, PNG or WebP thumbnail up to 150 KB."
        ) from None
