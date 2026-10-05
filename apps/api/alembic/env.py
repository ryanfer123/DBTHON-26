from alembic import context
from sqlalchemy import create_engine

from app.core.config import Settings

url = Settings().connection_url()
if url is None:
    raise RuntimeError("Configure the local PostgreSQL connection before migrating.")
if context.is_offline_mode():
    raise RuntimeError("Baseline migration requires an online PostgreSQL connection.")
elif context.config.attributes.get("connection") is not None:
    context.configure(connection=context.config.attributes["connection"])
    with context.begin_transaction():
        context.run_migrations()
else:
    with create_engine(url, hide_parameters=True).connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()
