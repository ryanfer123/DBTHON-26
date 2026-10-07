import type { Listing } from "./data";

export function FoodDeclarations({ food }: { food: Listing }) {
  return (
    <section aria-label="Donor food declarations">
      <h3>Donor checklist</h3>
      {food.safety_confirmed_at ? (
        <>
          <p>
            Stored {food.storage_handling?.toLowerCase()} ·{" "}
            {food.packed
              ? "Packed for collection"
              : "Not packed — arrange containers"}
          </p>
          <p>
            Declared allergens:{" "}
            {food.allergens?.length
              ? food.allergens.join(", ")
              : "None known to the donor"}
            .
          </p>
          {!!food.diet_tags?.length && (
            <p>Diet tags: {food.diet_tags.join(", ")}</p>
          )}
          <p className="field-help">
            Donor declarations, not a safety or allergy certification. Confirm
            ingredients and handling before accepting food; cross-contact may
            occur.
          </p>
        </>
      ) : (
        <p className="notice">
          No food-handling or allergen checklist has been supplied for this
          listing. Ask the donor before collecting.
        </p>
      )}
    </section>
  );
}
