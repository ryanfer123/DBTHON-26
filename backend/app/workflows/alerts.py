"""Bounded Twilio transport. Provider acceptance is distinct from device delivery."""

import base64
import json
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from sqlalchemy import text

from app.core.access import Access
from app.core.config import Settings


def channels(settings: Settings, require_credential: bool = True) -> list[str]:
    if not (settings.twilio_account_sid and settings.alert_demo_phone):
        return []
    if require_credential and not settings.twilio_auth_token:
        return []
    return (["SMS"] if settings.twilio_sms_from else []) + (
        ["WhatsApp"]
        if settings.twilio_whatsapp_from and settings.twilio_whatsapp_content_sid
        else []
    )


class TwilioTransport:
    def __init__(self, settings: Settings):
        self.settings = settings

    def request(self, path: str, fields: dict[str, str] | None = None) -> dict[str, str]:
        s = self.settings
        if s.twilio_auth_token is None or not re.fullmatch(
            r"AC[0-9a-fA-F]{32}", s.twilio_account_sid
        ):
            raise ValueError("Provider configuration unavailable")
        authorization = base64.b64encode(
            f"{s.twilio_account_sid}:{s.twilio_auth_token.get_secret_value()}".encode()
        ).decode()
        req = Request(
            f"https://api.twilio.com/2010-04-01/Accounts/{s.twilio_account_sid}/Messages{path}.json",
            data=urlencode(fields).encode() if fields is not None else None,
            headers={"Authorization": f"Basic {authorization}"},
        )
        with urlopen(req, timeout=5) as response:  # no provider response bodies are logged
            result: dict[str, str] = json.loads(response.read(16384))
        return result

    def send(self, channel: str, phone: str, message: str) -> tuple[str, str]:
        if phone != self.settings.alert_demo_phone:
            raise ValueError("Recipient is outside demo scope")
        fields = {"To": phone, "From": self.settings.twilio_sms_from, "Body": message}
        if channel == "WhatsApp":
            fields = {
                "To": f"whatsapp:{phone}",
                "From": self.settings.twilio_whatsapp_from,
                "ContentSid": self.settings.twilio_whatsapp_content_sid,
                "ContentVariables": json.dumps({"1": message}),
            }
        response = self.request("", fields)
        sid = response.get("sid", "")
        if not re.fullmatch(r"SM[0-9a-fA-F]{32}", sid):
            raise ValueError("Provider did not supply a receipt")
        return sid, response.get("status", "accepted")

    def receipt(self, sid: str) -> str:
        if not re.fullmatch(r"SM[0-9a-fA-F]{32}", sid):
            raise ValueError("Invalid receipt")
        state = self.request(f"/{sid}").get("status", "unknown")
        return (
            state
            if state
            in {
                "accepted",
                "queued",
                "sending",
                "sent",
                "delivered",
                "read",
                "failed",
                "undelivered",
            }
            else "unknown"
        )


def deliver_external(access: Access, settings: Settings) -> dict[str, int]:
    supported = channels(settings)
    counts = {"external_accepted": 0, "external_failed": 0, "external_delivered": 0}
    if not supported:
        return counts
    transport = TwilioTransport(settings)
    with access.transaction("worker") as c:
        leases = (
            c.execute(
                text("SELECT * FROM dbthon_lease_external_alerts(:phones,:channels,:cap)"),
                {
                    "phones": [settings.alert_demo_phone],
                    "channels": supported,
                    "cap": settings.alert_daily_limit,
                },
            )
            .mappings()
            .all()
        )
    for lease in leases:
        sid, state = None, "unknown"
        try:
            sid, state = transport.send(lease["channel"], lease["phone"], lease["message"])
        except Exception:
            pass  # record a bounded redacted failure; never log contacts or credentials
        with access.transaction("worker") as c:
            c.execute(
                text("SELECT dbthon_finish_external_alert(:id,:token,:sid,:state)"),
                {
                    "id": lease["outbox_id"],
                    "token": lease["lease_token"],
                    "sid": sid,
                    "state": state,
                },
            )
        counts["external_accepted" if sid else "external_failed"] += 1
    with access.transaction("worker") as c:
        receipts = c.execute(text("SELECT * FROM dbthon_external_receipts()")).mappings().all()
    for receipt in receipts:
        try:
            state = transport.receipt(receipt["provider_sid"])
        except Exception:
            continue
        with access.transaction("worker") as c:
            c.execute(
                text("SELECT dbthon_record_external_receipt(:id,:sid,:state)"),
                {"id": receipt["outbox_id"], "sid": receipt["provider_sid"], "state": state},
            )
        counts["external_delivered"] += int(state in {"delivered", "read"})
    return counts
