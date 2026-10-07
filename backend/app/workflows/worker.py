"""Small committed batches; no network provider runs inside a transaction."""

from typing import Protocol

from sqlalchemy import text

from app.core.access import Access


class InAppAdapter(Protocol):
    def available(self) -> bool: ...


class DatabaseInbox:
    def available(self) -> bool:
        # The real delivery is the atomic sent_at update, not a log-only adapter.
        return True


def tick(access: Access, adapter: InAppAdapter | None = None) -> dict[str, int]:
    inbox = adapter or DatabaseInbox()
    counts = {"expired_or_missed": 0, "notifications_delivered": 0, "notifications_retried": 0}
    with access.transaction("worker") as connection:
        ids = connection.execute(text("SELECT dbthon_due_listings(100)")).scalars().all()
    # One listing per committed transaction maintains domain -> sorted-user lock order.
    for listing_id in ids:
        with access.transaction("worker") as connection:
            changed = connection.execute(
                text("SELECT dbthon_expire_one(:id)"), {"id": listing_id}
            ).scalar_one()
            counts["expired_or_missed"] += int(changed)
    with access.transaction("worker") as connection:
        leases = (
            connection.execute(text("SELECT * FROM dbthon_lease_notifications(100)"))
            .mappings()
            .all()
        )
    for lease in leases:
        try:
            success = inbox.available()
        except Exception:
            success = False
        with access.transaction("worker") as connection:
            completed = connection.execute(
                text("SELECT dbthon_finish_notification(:id,:token,:success)"),
                {
                    "id": lease["outbox_id"],
                    "token": lease["lease_token"],
                    "success": success,
                },
            ).scalar_one()
            if completed:
                counts["notifications_delivered" if success else "notifications_retried"] += 1
    return counts
