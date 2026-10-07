"""Cross-zone bootstrap admin and mandatory community area confirmation.

Revision ID: 0008
Revises: 0007
"""

from alembic import op

from app.core.config import ROOT

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute(
            (ROOT / "database/0008_global_admin_zone_review.sql").read_text(),
            prepare=False,
        )


def downgrade() -> None:
    raise NotImplementedError(
        "Zone confirmation and admin audit data are retained; "
        "use a reviewed forward migration."
    )
