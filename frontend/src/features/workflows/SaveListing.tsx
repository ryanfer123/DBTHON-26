import { useState } from "react";
import { useCommand, type Listing } from "./data";
import { Feedback } from "./Workspace";

export function SaveListing({
  food,
  onChange,
}: {
  food: Listing;
  onChange?: () => void;
}) {
  const command = useCommand();
  const [saved, setSaved] = useState(!!food.is_saved);
  const available =
    ["Available", "Claimed"].includes(food.status) &&
    food.seconds_remaining > 0;
  if (!saved && !available) return null;
  return (
    <div>
      <button
        className="text-button"
        aria-pressed={saved}
        disabled={command.busy}
        onClick={async () => {
          if (
            await command.run(
              `/listings/${food.listing_id}/${saved ? "unsave" : "save"}`,
            )
          ) {
            setSaved(!saved);
            onChange?.();
          }
        }}
      >
        {saved ? "Remove from saved" : "Save listing"}
      </button>
      <Feedback {...command} />
    </div>
  );
}
