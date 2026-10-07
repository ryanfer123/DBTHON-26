import { useState, type FormEvent } from "react";
import { useAuth } from "../identity/AuthContext";
import { date, localInput, useCommand, type Exchange } from "./data";
import { Feedback } from "./Workspace";

export function PickupAgreement({
  exchange,
  refresh,
}: {
  exchange: Exchange;
  refresh: () => void;
}) {
  const { session } = useAuth(),
    command = useCommand(),
    [rescheduling, setRescheduling] = useState(false);
  const uid = session?.user.user_id;
  if (
    exchange.status !== "Confirmed" ||
    exchange.pickup_status !== "Scheduled" ||
    !exchange.schedule_version
  )
    return null;
  const people = [
    { id: exchange.donor_id, label: "Donor" },
    { id: exchange.receiver_id, label: "Receiver" },
    { id: exchange.volunteer_id, label: "Volunteer" },
  ];
  const accepted = exchange.schedule_confirmed_by ?? [];
  const participant = people.some((p) => p.id === uid);
  const confirmed = people.every(
    (p) => p.id !== null && accepted.includes(p.id),
  );
  async function change(time?: string) {
    if (
      await command.run(
        `/claims/${exchange.claim_id}/pickups/${exchange.pickup_id}/schedule`,
        {
          version: exchange.schedule_version,
          ...(time ? { scheduled_time: new Date(time).toISOString() } : {}),
        },
      )
    ) {
      command.setNotice(
        time
          ? "New pickup time proposed. Everyone must agree again."
          : "Your pickup time agreement was saved.",
      );
      setRescheduling(false);
      refresh();
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void change(
      String(new FormData(event.currentTarget).get("scheduled_time")),
    );
  }
  return (
    <section className="pickup-agreement" aria-label="Pickup time agreement">
      <h3>
        {confirmed ? "Pickup time agreed" : "Awaiting pickup time agreements"}
      </h3>
      <p>{date(exchange.scheduled_time)}</p>
      <ul>
        {people.map((p) => (
          <li key={p.label}>
            {p.label}:{" "}
            {p.id !== null && accepted.includes(p.id)
              ? "Agreed"
              : "Awaiting agreement"}
          </li>
        ))}
      </ul>
      <Feedback {...command} />
      {participant && (
        <>
          <div className="actions">
            {uid && !accepted.includes(uid) && (
              <button
                className="button button-small"
                disabled={command.busy}
                onClick={() => void change()}
              >
                Agree to pickup time
              </button>
            )}
            <button
              className="text-button"
              disabled={command.busy}
              onClick={() => setRescheduling(!rescheduling)}
            >
              Propose another time
            </button>
          </div>
          {rescheduling && (
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor={`new-time-${exchange.pickup_id}`}>
                  New pickup time
                </label>
                <input
                  id={`new-time-${exchange.pickup_id}`}
                  name="scheduled_time"
                  type="datetime-local"
                  defaultValue={localInput(new Date(exchange.scheduled_time!))}
                  required
                />
                <p className="field-help">
                  Use a future time within the donor’s collection window. The
                  other two participants must accept it.
                </p>
              </div>
              <button
                className="button button-small"
                disabled={command.busy}
                type="submit"
              >
                Send new time proposal
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
