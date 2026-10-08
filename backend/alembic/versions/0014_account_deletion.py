"""Permanent account deletion with retained audit identity.

Revision ID: 0014
Revises: 0012 (0013 reserved by the undeployed browser-push branch).
"""

from alembic import op

from app.core.config import ROOT

revision = "0014"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute((ROOT / "database/0014_account_deletion.sql").read_text(), prepare=False)


def downgrade() -> None:
    raise NotImplementedError("Deleted profile data cannot be restored; use a forward migration.")
