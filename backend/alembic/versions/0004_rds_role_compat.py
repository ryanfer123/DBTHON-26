"""Keep the private function owner compatible with managed PostgreSQL.

Revision ID: 0004
Revises: 0003
"""

from alembic import op

from app.core.config import ROOT

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute((ROOT / "database/0004_rds_role_compat.sql").read_text(), prepare=False)


def downgrade() -> None:
    raise NotImplementedError(
        "The RDS-safe function owner policies replace PostgreSQL superuser behavior and "
        "cannot be safely downgraded on managed PostgreSQL."
    )
