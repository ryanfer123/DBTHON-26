import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../identity/AuthContext";
import { LocationFields } from "../identity/FormParts";
import { useOverview } from "./OverviewContext";
import { localInput, useCommand, type Listing } from "./data";
import { thumbnail } from "./photo";
import { Feedback } from "./Workspace";

function remembered(
  user: number,
  fallback: [string, string],
): [string, string] {
  try {
    const point = JSON.parse(
      localStorage.getItem(`second-table-pickup:${user}`) ?? "null",
    );
    return Array.isArray(point) &&
      point.length === 2 &&
      point.every((v) => typeof v === "string") &&
      Math.abs(Number(point[0])) <= 90 &&
      Math.abs(Number(point[1])) <= 180
      ? (point as [string, string])
      : fallback;
  } catch {
    return fallback;
  }
}
export function ListingForm({
  food,
  repeat = false,
}: {
  food?: Listing;
  repeat?: boolean;
}) {
  const { session } = useAuth(),
    overview = useOverview();
  const navigate = useNavigate(),
    command = useCommand();
  const [search] = useSearchParams();
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [photoBusy, setPhotoBusy] = useState(false),
    [photoError, setPhotoError] = useState("");
  const editing = !!food && !repeat;
  const [name, setName] = useState(food?.food_type ?? "");
  const [category, setCategory] = useState(food?.category ?? "Veg");
  const [quantity, setQuantity] = useState(food?.quantity_kg ?? "");
  const [preset, setPreset] = useState(editing ? "custom" : "2");
  const [point, setPoint] = useState<[string, string]>(() =>
    food
      ? [food.pickup_lat, food.pickup_long]
      : remembered(session!.user.user_id, [
          session!.user.latitude,
          session!.user.longitude,
        ]),
  );
  const [anchor] = useState(() => ({
    server: overview.data?.meta.server_time
      ? Date.parse(overview.data.meta.server_time) +
        Math.max(0, Date.now() - (overview.updatedAt ?? Date.now()))
      : Date.now(),
    local: performance.now(),
  }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const now = new Date(
      anchor.server + performance.now() - anchor.local - 1000,
    );
    const body = {
      food_type: name.trim(),
      category,
      quantity_kg: quantity,
      prepared_at:
        preset === "custom"
          ? new Date(String(form.get("prepared_at"))).toISOString()
          : now.toISOString(),
      expiry_window_start:
        preset === "custom"
          ? new Date(String(form.get("start"))).toISOString()
          : now.toISOString(),
      expiry_window_end:
        preset === "custom"
          ? new Date(String(form.get("end"))).toISOString()
          : new Date(now.getTime() + Number(preset) * 3600000).toISOString(),
      pickup_lat: form.get("latitude"),
      pickup_long: form.get("longitude"),
      ...(photo !== undefined ? { photo_base64: photo } : {}),
    };
    const result = await command.run(
      editing ? `/listings/${food.listing_id}` : "/listings",
      body,
      editing ? "PATCH" : "POST",
    );
    if (result) {
      try {
        localStorage.setItem(
          `second-table-pickup:${session!.user.user_id}`,
          JSON.stringify(point),
        );
      } catch {
        /* Saving location is optional. */
      }
      const requestId = search.get("request_id");
      navigate(
        requestId && /^\d+$/.test(requestId)
          ? `/requests/${requestId}?new_listing=${result.data.listing_id}`
          : `/food/${result.data.listing_id}`,
      );
    }
  }
  return (
    <div className="listing-editor-layout">
      <form onSubmit={submit} className="listing-form">
        <fieldset disabled={command.busy} className="form-fields">
          {repeat && (
            <p className="notice">
              Copied your donation details. Collection times are fresh; confirm
              the quantity and pickup point before publishing.
            </p>
          )}
          <div className="field">
            <label htmlFor="food-name">Food name</label>
            <input
              id="food-name"
              name="food_type"
              required
              maxLength={80}
              pattern=".*\S.*"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="food-category">Category</label>
              <select
                id="food-category"
                name="category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as Listing["category"])
                }
              >
                <option value="Veg">Vegetarian</option>
                <option value="NonVeg">Non-vegetarian</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="quantity">Whole quantity (kg)</label>
              <input
                id="quantity"
                name="quantity_kg"
                type="number"
                min="0.01"
                max="999999.99"
                step="0.01"
                required
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <div className="actions">
                <button
                  type="button"
                  className="quantity-step"
                  aria-label="Decrease quantity by half a kilogram"
                  onClick={() =>
                    setQuantity(
                      Math.max(0.01, Number(quantity) - 0.5).toFixed(2),
                    )
                  }
                >
                  − 0.5
                </button>
                <button
                  type="button"
                  className="quantity-step"
                  aria-label="Increase quantity by half a kilogram"
                  onClick={() =>
                    setQuantity(
                      Math.min(999999.99, Number(quantity) + 0.5).toFixed(2),
                    )
                  }
                >
                  + 0.5
                </button>
              </div>
              <small>
                About {(Number(quantity) / 0.4).toFixed(1)} meal equivalents.
                Project estimate: 0.4 kg per meal.
              </small>
            </div>
          </div>
          <fieldset className="collection-presets">
            <legend>Collect within…</legend>
            <div className="actions">
              {["1", "2", "4", "6", "custom"].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="button button-outline button-small"
                  aria-pressed={preset === value}
                  onClick={() => setPreset(value)}
                >
                  {value === "custom" ? "Custom" : `${value} h`}
                </button>
              ))}
            </div>
          </fieldset>
          {preset === "custom" && (
            <>
              <div className="field">
                <label htmlFor="prepared">Prepared at</label>
                <input
                  id="prepared"
                  name="prepared_at"
                  type="datetime-local"
                  required
                  defaultValue={
                    editing
                      ? localInput(new Date(food.prepared_at))
                      : localInput()
                  }
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="collection-start">Collection opens</label>
                  <input
                    id="collection-start"
                    name="start"
                    type="datetime-local"
                    required
                    defaultValue={
                      editing
                        ? localInput(new Date(food.expiry_window_start))
                        : localInput()
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="collection-end">Collect by</label>
                  <input
                    id="collection-end"
                    name="end"
                    type="datetime-local"
                    required
                    defaultValue={
                      editing
                        ? localInput(new Date(food.expiry_window_end))
                        : localInput(new Date(anchor.server + 7200000))
                    }
                  />
                </div>
              </div>
            </>
          )}
          <p className="field-help">
            {preset === "custom"
              ? "Times use your device’s timezone. Preparation must precede collection; the deadline must be in the future and within seven days."
              : "Ready now, with a collection window you choose."}{" "}
            Deadlines are provided by donors; these presets do not certify food
            safety.
          </p>
          <LocationFields
            legend="Pickup point"
            latitude={point[0]}
            longitude={point[1]}
            onChange={(lat, lon) => setPoint([lat, lon])}
          />
          <div className="field">
            <label htmlFor="food-photo">Food photo (optional)</label>
            <input
              id="food-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={photoBusy}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setPhotoBusy(true);
                setPhotoError("");
                try {
                  setPhoto(await thumbnail(file));
                } catch (error) {
                  setPhotoError((error as Error).message);
                  setPhoto(undefined);
                } finally {
                  setPhotoBusy(false);
                }
              }}
            />
            <small>
              Resized to 800 px and 150 KB. Location metadata is removed. A
              photo does not certify food safety.
            </small>
            {photoBusy && <p role="status">Preparing photo…</p>}
            {photoError && (
              <p className="notice notice-error" role="alert">
                {photoError}
              </p>
            )}
            {(photo || (editing && food.has_photo)) && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setPhoto(null);
                  setPhotoError("");
                }}
              >
                Remove photo
              </button>
            )}
          </div>
          <Feedback {...command} />
          <div className="actions">
            <button
              className="button button-small"
              type="submit"
              disabled={photoBusy}
            >
              {command.busy
                ? "Saving…"
                : editing
                  ? "Save listing"
                  : "Publish listing"}
            </button>
            <Link
              className="text-link"
              to={editing ? `/food/${food.listing_id}` : "/donations"}
            >
              Back
            </Link>
          </div>
        </fieldset>
      </form>
      <aside className="listing-preview">
        <h2>Receiver preview</h2>
        {photo && (
          <img
            className="listing-photo-large"
            src={`data:image/jpeg;base64,${photo}`}
            width="800"
            height="600"
            alt="Your selected food preview"
          />
        )}
        <h3>{name.trim() || "Your food name"}</h3>
        <p>
          {category === "Veg" ? "Vegetarian" : "Non-vegetarian"} ·{" "}
          {quantity || "0"} kg
        </p>
        <p>
          {preset === "custom"
            ? "Your custom collection deadline"
            : `Ready now · collect within ${preset} h`}
        </p>
        <p className="field-help">
          Pickup point: {point.join(", ")}. Eligibility and donor verification
          are checked by the server when published.
        </p>
      </aside>
    </div>
  );
}
