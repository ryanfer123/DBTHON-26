import { useEffect, useState } from "react";
import { apiUrl } from "../lib/identity";
export function ListingPhoto({
  listingId,
  large = false,
}: {
  listingId: number;
  large?: boolean;
}) {
  const [photo, setPhoto] = useState<{ id: number; url: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    fetch(apiUrl(`/listings/${listingId}/photo`), {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const image = await response.blob();
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(image);
        setPhoto({ id: listingId, url });
      })
      .catch(() => {
        /* The listing remains usable if its optional photo fails. */
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [listingId]);
  return photo?.id === listingId ? (
    <img
      className={large ? "listing-photo-large" : "listing-photo"}
      src={photo.url}
      alt="Donor-provided food photo; inspect preparation and handling before accepting."
      width={large ? 800 : 120}
      height={large ? 600 : 90}
    />
  ) : null;
}
