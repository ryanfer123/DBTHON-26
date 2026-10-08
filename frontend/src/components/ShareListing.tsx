import { useState } from "react";

export function ShareListing({ listingId }: { listingId: number }) {
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState(false);
  const url = `${window.location.origin}/food/${listingId}`;
  return (
    <div className="share-listing">
      <button
        className="text-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setMessage(
              "Listing link copied. Access still requires a verified community account.",
            );
            setFallback(false);
          } catch {
            setFallback(true);
            setMessage("Select and copy the link below.");
          }
        }}
      >
        Copy listing link
      </button>
      <a
        className="text-link"
        href={`https://wa.me/?text=${encodeURIComponent(`Food available on NomNom: ${url}. Sign in to your verified community account to view details.`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Share on WhatsApp
      </a>
      {message && (
        <p role="status" className="field-help">
          {message}
        </p>
      )}
      {fallback && (
        <div className="field">
          <label htmlFor="listing-link">Listing link</label>
          <input
            id="listing-link"
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
          />
        </div>
      )}
    </div>
  );
}
