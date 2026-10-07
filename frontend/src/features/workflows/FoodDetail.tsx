import { SaveListing } from "./SaveListing";
import { ReportIssue } from "./Experience";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { FoodDeclarations } from "./FoodDeclarations";
import { Freshness } from "../../components/Freshness";
import { ListingPhoto } from "../../components/ListingPhoto";
import { DonorTrust } from "./FoodRow";
import { LocationMap } from "../../components/maps/LocationMap";
import { ShareListing } from "../../components/ShareListing";
import { useAuth } from "../identity/AuthContext";
import {
  date,
  useCommand,
  useQuery,
  type Listing,
  type Resource,
} from "./data";
import { Countdown, Feedback, QueryStatus, Workspace } from "./Workspace";

function ReasonForm({
  label,
  busy,
  onSubmit,
}: {
  label: string;
  busy: boolean;
  onSubmit: (reason: string) => Promise<void>;
}) {
  return (
    <form
      className="reason-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(
          String(new FormData(event.currentTarget).get("reason")).trim(),
        );
      }}
    >
      <fieldset className="form-fields" disabled={busy}>
        <div className="field">
          <label htmlFor="cancel-reason">Cancellation reason</label>
          <textarea
            id="cancel-reason"
            name="reason"
            minLength={3}
            maxLength={300}
            rows={2}
            required
          />
        </div>
        <button className="button button-outline button-small" type="submit">
          {busy ? "Saving…" : label}
        </button>
      </fieldset>
    </form>
  );
}

export function FoodDetailPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const query = useQuery<Resource<Listing>>(`/listings/${id}`);
  const command = useCommand();
  const [cancelling, setCancelling] = useState(false);
  const food = query.data?.data;
  const owner = food?.donor_id === session?.user.user_id;
  const receiver = session?.user.capabilities.includes("Receiver");
  const live =
    !!food && food.status === "Available" && food.seconds_remaining > 0;
  return (
    <Workspace
      title={food?.food_type ?? "Food details"}
      intro="Check the whole quantity and collection window."
    >
      <Freshness {...query} />
      <QueryStatus {...query} loading={query.loading && !query.data} />
      <Feedback {...command} />
      {food && query.data && (
        <div className="detail-layout">
          <section>
            {food.has_photo && (
              <ListingPhoto
                key={`${food.listing_id}:${query.data.meta.server_time}`}
                listingId={food.listing_id}
                large
              />
            )}
            <DonorTrust food={food} />
            <FoodDeclarations food={food} />
            {food.has_photo && session?.user.capabilities.includes("Admin") && (
              <button
                className="text-button"
                disabled={command.busy}
                onClick={async () => {
                  if (
                    window.confirm(
                      "Remove this listing photo? The removal will be recorded in the audit history.",
                    ) &&
                    (await command.run(
                      `/admin/listings/${food.listing_id}/photo/remove`,
                    ))
                  )
                    query.refresh();
                }}
              >
                Remove photo as administrator
              </button>
            )}
            <p className="detail-emphasis">
              {food.quantity_kg} kg ·{" "}
              {food.category === "Veg" ? "Vegetarian" : "Non-vegetarian"}
            </p>
            <dl className="detail-list">
              <dt>Shared by</dt>
              <dd>{food.donor_name}</dd>
              <dt>Status</dt>
              <dd>{food.status}</dd>
              <dt>Prepared</dt>
              <dd>{date(food.prepared_at)}</dd>
              <dt>Collection opens</dt>
              <dd>{date(food.expiry_window_start)}</dd>
              <dt>Collect by</dt>
              <dd>{date(food.expiry_window_end)}</dd>
              <dt>Pickup point</dt>
              <dd>
                <LocationMap lat={food.pickup_lat} lon={food.pickup_long} />
              </dd>
            </dl>
            <button
              className="text-button"
              onClick={query.refresh}
              disabled={query.loading}
            >
              Refresh this listing
            </button>
            <ShareListing listingId={food.listing_id} />
            <SaveListing
              key={`${food.listing_id}:${food.is_saved}`}
              food={food}
            />
            <ReportIssue listingId={food.listing_id} />
          </section>
          <aside className="workflow-aside">
            {["Available", "Claimed", "PickedUp"].includes(food.status) && (
              <Countdown
                key={query.data!.meta.server_time}
                end={food.expiry_window_end}
                serverTime={query.data!.meta.server_time}
              />
            )}
            {owner ? (
              <>
                <h2>Your donation</h2>
                <Link
                  className="button button-outline button-small"
                  to={`/donations/new?repeat=${food.listing_id}`}
                >
                  List again
                </Link>
                <p>
                  {live
                    ? "You can edit this listing until a receiver claims it."
                    : "Its allocation history is kept in your exchanges."}
                </p>
                <div className="actions">
                  {live && (
                    <Link
                      className="button button-small"
                      to={`/donations/${food.listing_id}/edit`}
                    >
                      Edit listing
                    </Link>
                  )}
                  <Link className="text-link" to="/claims">
                    View exchanges
                  </Link>
                </div>
                {["Available", "Claimed"].includes(food.status) && (
                  <>
                    <button
                      className="text-button"
                      onClick={() => setCancelling((value) => !value)}
                    >
                      {cancelling ? "Keep listing" : "Cancel listing"}
                    </button>
                    {cancelling && (
                      <ReasonForm
                        label="Confirm cancellation"
                        busy={command.busy}
                        onSubmit={async (reason) => {
                          if (
                            await command.run(
                              `/listings/${food.listing_id}/cancel`,
                              { reason },
                            )
                          ) {
                            setCancelling(false);
                            command.setNotice("Listing cancelled.");
                            query.refresh();
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </>
            ) : receiver ? (
              <>
                <h2>Claim the whole quantity</h2>
                <p>
                  Claiming reserves this food for you. A volunteer can then
                  arrange collection and delivery.
                </p>
                <button
                  className="button button-small"
                  disabled={command.busy || !food.claim_eligible}
                  onClick={async () => {
                    const result = await command.run(
                      `/listings/${food.listing_id}/claims`,
                    );
                    if (result) navigate(`/claims/${result.data.claim_id}`);
                  }}
                >
                  {command.busy
                    ? "Reserving…"
                    : food.claim_eligible
                      ? `Claim ${food.quantity_kg} kg`
                      : "Cannot claim this food"}
                </button>
                {!food.claim_eligible && (
                  <p className="notice">{food.claim_ineligible_reason}</p>
                )}
              </>
            ) : (
              <p>
                This listing is visible within your community. Claiming requires
                an approved Receiver role.
              </p>
            )}
            <p className="field-help">
              The server rechecks the deadline, distance, capacity and
              availability when you act.
            </p>
          </aside>
        </div>
      )}
    </Workspace>
  );
}
