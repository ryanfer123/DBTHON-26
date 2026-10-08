"""Opt-in browser subscriptions and transactional background delivery."""

from alembic import op

from app.core.config import ROOT

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute((ROOT / "database/0013_browser_push.sql").read_text(), prepare=False)


def downgrade() -> None:
    raise NotImplementedError("Use a forward migration to preserve delivery records.")
