import { useAuth } from "../identity/AuthContext";
import type { Exchange } from "./data";

export function ExchangeProgress({ exchange }: { exchange: Exchange }) {
  const { session } = useAuth();
  const userId = session?.user.user_id;
  const terminal = ["Cancelled", "Expired"].includes(exchange.status);
  const delivered = exchange.status === "Completed";
  const rated = delivered && exchange.my_rating != null;
  const canRate =
    userId === exchange.donor_id || userId === exchange.receiver_id;
  const doneForUser = delivered && (rated || !canRate);
  const step = delivered
    ? 4
    : exchange.pickup_status === "PickedUp"
      ? 2
      : exchange.pickup_status === "Scheduled"
        ? 1
        : 0;
  const next = delivered
    ? rated
      ? "Your rating is recorded. This exchange is complete for you."
      : canRate
        ? "Delivery complete. Add your rating to finish."
        : "Delivery complete. No rating is required from you."
    : [
        "Reserved. Waiting for a volunteer — updates will appear in your inbox.",
        "A volunteer is assigned. Keep the food ready for collection.",
        "Picked up. The volunteer will confirm delivery next.",
      ][step];
  return (
    <section className="exchange-progress">
      <div className="exchange-progress-heading">
        <h2>What happens next</h2>
        {doneForUser && <span className="badge">Done for you</span>}
      </div>
      {terminal ? (
        <p className="notice">
          This exchange is {exchange.status.toLowerCase()}. No further
          collection or rating action is available.
        </p>
      ) : (
        <>
          <ol className="status-stepper" aria-label="Exchange progress">
            {[
              "Claimed",
              "Volunteer assigned",
              "Picked up",
              "Delivered",
              "Your rating",
            ].map((label, index) => {
              const notRequired =
                delivered && index === 4 && !rated && !canRate;
              const done = index < step || (doneForUser && index === 4);
              const current = !doneForUser && index === step;
              const state = done ? "done" : current ? "current" : "upcoming";
              return (
                <li
                  key={label}
                  data-state={state}
                  aria-current={current ? "step" : undefined}
                >
                  <span className="exchange-step-number" aria-hidden="true">
                    {done ? "✓" : index + 1}
                  </span>
                  <span className="exchange-step-copy">
                    {label}
                    <strong className="exchange-step-current">
                      {notRequired
                        ? "Not required"
                        : done
                          ? "Done"
                          : current
                            ? "Current"
                            : "Upcoming"}
                    </strong>
                  </span>
                </li>
              );
            })}
          </ol>
          <p>{next}</p>
        </>
      )}
    </section>
  );
}
