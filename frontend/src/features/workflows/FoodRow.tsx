import { ListingPhoto } from "../../components/ListingPhoto";
import { Link } from "react-router";
import { date, type Listing } from "./data";
import { Countdown } from "./Workspace";
export function DonorTrust({ food }: { food: Listing }) {
  return (
    <p className="donor-trust">
      {food.donor_verified
        ? "✓ Verified donor"
        : "Donor verification unavailable"}{" "}
      ·{" "}
      {food.donor_rating_avg === null || food.donor_rating_avg === undefined
        ? "New donor — no ratings yet"
        : `★ ${Number(food.donor_rating_avg).toFixed(1)} (${food.donor_rating_count} ratings)`}
    </p>
  );
}
export function FoodRow({
  food,
  serverTime,
  parent,
  selected,
  onSelect,
  onHideCancelled,
  own,
}: {
  food: Listing;
  serverTime: string;
  parent: string;
  selected?: boolean;
  onSelect?: () => void;
  onHideCancelled?: () => void;
  own: boolean;
}) {
  return (
    <li
      className={`food-row ${selected ? "selected" : ""} ${!own && !food.claim_eligible ? "ineligible" : ""}`}
      data-listing-id={food.listing_id}
    >
      <div className="food-name">
        {food.has_photo && <ListingPhoto listingId={food.listing_id} />}
        <h2>{food.food_type}</h2>
        <p>{food.donor_name}</p>
        <DonorTrust food={food} />
        <span className="food-tag">
          {food.category === "Veg" ? "Vegetarian" : "Non-vegetarian"}
        </span>
        {!!food.diet_tags?.length && (
          <p className="food-tag">
            {food.diet_tags.join(" · ")} (donor declared)
          </p>
        )}
        <p className="field-help">
          {food.safety_confirmed_at
            ? `Allergens: ${food.allergens?.join(", ") || "none known"}`
            : "Allergen checklist not supplied"}
        </p>
        <strong className="food-weight">{food.quantity_kg} kg</strong>
      </div>
      <div className="food-timing">
        <p>Prepared {date(food.prepared_at)}</p>
        <p>Collect by {date(food.expiry_window_end)}</p>
        <span className="field-help">
          {food.distance_m !== null
            ? `${(food.distance_m / 1000).toFixed(1)} km away`
            : food.status}
        </span>
        {!own && !food.claim_eligible && (
          <p className="field-help">{food.claim_ineligible_reason}</p>
        )}
      </div>
      <div>
        {["Available", "Claimed", "PickedUp"].includes(food.status) ? (
          <Countdown
            key={serverTime}
            end={food.expiry_window_end}
            serverTime={serverTime}
          />
        ) : (
          <strong>{food.status}</strong>
        )}
      </div>
      <div className="actions">
        {onSelect && (
          <button
            className="text-button"
            aria-pressed={selected}
            onClick={onSelect}
          >
            Show on map
          </button>
        )}
        <Link
          className="button button-outline button-small"
          to={`/food/${food.listing_id}`}
          state={{ parent }}
        >
          View food
        </Link>
        {own && (
          <Link
            className="text-button"
            to={`/donations/schedules?listing=${food.listing_id}`}
          >
            Schedule daily
          </Link>
        )}
        {own && food.status === "Cancelled" && onHideCancelled && (
          <button className="text-button" onClick={onHideCancelled}>
            Remove from my list
          </button>
        )}
      </div>
    </li>
  );
}
