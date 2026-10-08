import { ThemedSelect } from "../../components/ThemedSelect";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Freshness } from "../../components/Freshness";
import { allergens, diets } from "./foodTags";
import { FoodRow } from "./FoodRow";
import { useAuth } from "../identity/AuthContext";
import { useListLocation } from "./useListLocation";
import { params, useCommand, useQuery, type Listing, type Rows } from "./data";
import {
  Access,
  Countdown,
  Pagination,
  QueryStatus,
  Feedback,
  Workspace,
} from "./Workspace";
const MapCanvas = lazy(() => import("../../components/maps/MapCanvas"));

export function FoodPage({ own = false }: { own?: boolean }) {
  const { session } = useAuth();
  const location = useLocation();
  const list = useListLocation();
  const view = list.value("view", "list", ["list", "map"]);
  const larger = list.value("larger") === "true";
  const [selected, setSelected] = useState<number | null>(null);
  const category = list.value("category", "", ["", "Veg", "NonVeg"]);
  const diet = list.value("diet_tags", "", ["", ...diets]);
  const excluded = list.value("exclude_allergens", "", ["", ...allergens]);
  const radius = list.value("radius_m", "5000", ["1000", "3000", "5000"]);
  const status = list.value("status", "", [
    "",
    "Available",
    "Claimed",
    "PickedUp",
    "Delivered",
    "Expired",
    "Cancelled",
  ]);
  const q = list.value("q").slice(0, 80);
  const sort = list.value("sort", "expiry", ["expiry", "newest", "listing"]);
  const [draft, setDraft] = useState({ source: q, value: q, submitted: q });
  if (draft.source !== q) {
    setDraft({
      source: q,
      value: q === draft.submitted ? draft.value : q,
      submitted: q,
    });
  }
  const [composing, setComposing] = useState(false);
  const searchInput = draft.value;
  const setFilters = list.setFilters;
  useEffect(() => {
    if (composing || searchInput.trim() === q) return;
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setDraft((current) => ({ ...current, submitted: next }));
      setFilters({ q: next }, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, q, composing, setFilters]);
  const { cursor, setCursor } = list;
  const query = useQuery<Rows<Listing>>(
    `${own ? "/listings/mine" : "/listings"}?${params(own ? { status, category, diet_tags: diet, exclude_allergens: excluded, sort, search_mode: "prefix", q, cursor: cursor ?? 0 } : { category, diet_tags: diet, exclude_allergens: excluded, radius_m: radius, search_mode: "prefix", q, cursor, include_over_capacity: String(larger) })}`,
    { deferNewRows: !own, poll: true },
  );
  const hideCommand = useCommand();
  return (
    <Access roles={[own ? "Donor" : "Receiver"]}>
      <Workspace
        title={own ? "My donations" : "Find nearby food"}
        intro={
          own
            ? "Your food, from listing to delivery."
            : "Whole quantities, within your community."
        }
        action={
          own && (
            <Link className="button button-small" to="/donations/new">
              List food
            </Link>
          )
        }
      >
        <h2 className="food-filters-heading">Search and filters</h2>
        <div className="workspace-toolbar" aria-label="Food search and filters">
          <form
            className="food-search"
            onSubmit={(event) => {
              event.preventDefault();
              const next = searchInput.trim();
              setDraft((current) => ({ ...current, submitted: next }));
              list.setFilters({ q: next });
            }}
          >
            <div className="field">
              <label htmlFor="food-search">Search food</label>
              <input
                id="food-search"
                name="q"
                type="search"
                maxLength={80}
                value={searchInput}
                placeholder="Type a name, e.g. ch"
                aria-describedby="food-search-hint"
                onChange={(event) => {
                  const value = event.target.value;
                  setDraft((current) => ({ ...current, value }));
                }}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
              />
            </div>
          </form>
          {own ? (
            <div className="field">
              <label htmlFor="food-status">Listing status</label>
              <ThemedSelect
                id="food-status"
                value={status}
                onValueChange={(e) => {
                  list.setFilters({ status: e });
                }}
              >
                <option value="">All listings</option>
                {[
                  "Available",
                  "Claimed",
                  "PickedUp",
                  "Delivered",
                  "Expired",
                  "Cancelled",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </ThemedSelect>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="radius">Search radius</label>
                <ThemedSelect
                  id="radius"
                  value={radius}
                  onValueChange={(e) => {
                    list.setFilters({ radius_m: e });
                  }}
                >
                  <option value="1000">1 km</option>
                  <option value="3000">3 km</option>
                  <option value="5000">5 km</option>
                </ThemedSelect>
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="category">Category</label>
            <ThemedSelect
              id="category"
              value={category}
              onValueChange={(e) => {
                list.setFilters({ category: e });
              }}
            >
              <option value="">All food</option>
              <option value="Veg">Vegetarian</option>
              <option value="NonVeg">Non-vegetarian</option>
            </ThemedSelect>
          </div>
          <div className="field">
            <label htmlFor="diet-filter">Diet tag</label>
            <ThemedSelect
              id="diet-filter"
              value={diet}
              onValueChange={(e) => list.setFilters({ diet_tags: e })}
            >
              <option value="">Any diet</option>
              {diets.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </ThemedSelect>
          </div>
          <div className="field">
            <label htmlFor="allergen-filter">Exclude declared allergen</label>
            <ThemedSelect
              id="allergen-filter"
              value={excluded}
              onValueChange={(e) => list.setFilters({ exclude_allergens: e })}
            >
              <option value="">No exclusion</option>
              {allergens.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </ThemedSelect>
          </div>
          {own && (
            <div className="field">
              <label htmlFor="food-sort">Sort by time</label>
              <ThemedSelect
                id="food-sort"
                value={sort}
                onValueChange={(value) => list.setFilters({ sort: value })}
              >
                <option value="expiry">Collection deadline</option>
                <option value="newest">Newest listings</option>
                <option value="listing">Oldest listings</option>
              </ThemedSelect>
            </div>
          )}
          <button
            className="text-button"
            onClick={() => {
              setDraft({ source: "", value: "", submitted: "" });
              list.clear();
            }}
          >
            Clear filters
          </button>
          <button
            className="text-button"
            onClick={query.refresh}
            disabled={query.loading}
          >
            Refresh food
          </button>
        </div>
        <p id="food-search-hint" className="field-help" aria-live="polite">
          {searchInput.trim() !== q || (query.loading && !query.data)
            ? "Updating results… "
            : ""}
          Search updates as you type and matches food names starting with your
          text.
          {own &&
            (sort === "expiry"
              ? " Sorted by collection deadline, earliest first."
              : sort === "newest"
                ? " Sorted by newest listing first."
                : " Sorted by oldest listing first.")}
        </p>
        <p className="field-help">
          Diet and allergen filters use donor declarations, not certifications.
          Listings without a checklist are excluded when an allergen exclusion
          is selected. Distances are straight-line estimates from your saved
          account location, not road travel distances.
        </p>
        {query.newCount > 0 && (
          <button
            className="button button-small new-listings"
            onClick={query.acceptPending}
          >
            {query.newCount} new listings — show updates
          </button>
        )}
        <Freshness {...query} />
        <Feedback error={hideCommand.error} notice={hideCommand.notice} />
        <QueryStatus {...query} loading={query.loading && !query.data} />
        {!own && (
          <>
            <p className="field-help">
              Sorted by collection deadline, then distance. Showing food up to{" "}
              {session!.user.capacity_kg} kg per claim.
            </p>
            {query.data && (
              <p>
                {query.data.meta.hidden_over_capacity_count ?? 0} larger
                listings nearby {larger ? "included" : "hidden"}.{" "}
                <button
                  className="text-button"
                  onClick={() => list.setFilters({ larger: String(!larger) })}
                >
                  {larger ? "Hide larger listings" : "Show larger listings"}
                </button>{" "}
                <Link className="text-link" to="/account">
                  Update capacity
                </Link>
              </p>
            )}
            <div className="actions">
              <button
                className="button button-outline button-small"
                aria-pressed={view === "list"}
                onClick={() => list.setFilters({ view: "list" })}
              >
                List view
              </button>
              <button
                className="button button-outline button-small"
                aria-pressed={view === "map"}
                onClick={() => list.setFilters({ view: "map" })}
              >
                Map view
              </button>
            </div>
          </>
        )}
        {query.data && (
          <>
            {!own && view === "map" && (
              <section className="feed-map">
                <h2>Pickup points on this page</h2>
                <p className="field-help">
                  Use the listing buttons below as the keyboard and offline
                  alternative.
                </p>
                <Suspense fallback={<p role="status">Loading pickup map…</p>}>
                  <MapCanvas
                    latitude={Number(session!.user.latitude)}
                    longitude={Number(session!.user.longitude)}
                    radius={Number(radius)}
                    selected={selected}
                    onSelect={setSelected}
                    points={query.data.data.map((food) => ({
                      id: food.listing_id,
                      latitude: Number(food.pickup_lat),
                      longitude: Number(food.pickup_long),
                      label: `${food.food_type} · ${food.quantity_kg} kg`,
                      urgent: food.approaching_expiry,
                    }))}
                  />
                </Suspense>
                {query.data.data
                  .filter((food) => food.listing_id === selected)
                  .map((food) => (
                    <div className="map-card" key={food.listing_id}>
                      <h3>{food.food_type}</h3>
                      <p>
                        {food.quantity_kg} kg ·{" "}
                        {(Number(food.distance_m) / 1000).toFixed(1)} km away
                      </p>
                      <Countdown
                        key={query.data!.meta.server_time}
                        end={food.expiry_window_end}
                        serverTime={query.data!.meta.server_time}
                      />
                      <Link
                        className="text-link"
                        to={`/food/${food.listing_id}`}
                        state={{ parent: location.pathname + location.search }}
                      >
                        View selected food
                      </Link>
                    </div>
                  ))}
              </section>
            )}
            <ul className="food-list">
              {query.data.data.map((food) => (
                <FoodRow
                  key={food.listing_id}
                  food={food}
                  own={own}
                  selected={selected === food.listing_id}
                  onSelect={
                    !own && view === "map"
                      ? () => setSelected(food.listing_id)
                      : undefined
                  }
                  onHideCancelled={
                    own && food.status === "Cancelled"
                      ? async () => {
                          if (
                            await hideCommand.run(
                              `/listings/${food.listing_id}/hide-cancelled`,
                            )
                          )
                            query.refresh();
                        }
                      : undefined
                  }
                  serverTime={query.data!.meta.server_time}
                  parent={location.pathname + location.search}
                />
              ))}
            </ul>
            {!query.data.data.length && (
              <div className="empty-state">
                <h2>
                  {own && !q && !status && !category && !diet && !excluded
                    ? "Your first donation starts here."
                    : "No food matches these filters."}
                </h2>
                <p>
                  {own
                    ? q || status || category || diet || excluded
                      ? "Try another name or clear the filters to see your other donations."
                      : "Add the food you can share and its collection window."
                    : "Try a wider radius or category. Change your filters or show larger listings above. The capacity count distinguishes food too large from no food nearby."}
                </p>
                {own && (
                  <Link className="text-link" to="/donations/new">
                    List your food
                  </Link>
                )}
              </div>
            )}
            <Pagination
              previous={list.previous}
              meta={query.data.meta}
              cursor={cursor}
              setCursor={setCursor}
            />
            <p className="workspace-note">
              Collection deadlines are provided by donors. Check preparation and
              handling before accepting food.
            </p>
          </>
        )}
      </Workspace>
    </Access>
  );
}
