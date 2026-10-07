import { lazy, Suspense, useState } from "react";
const MapCanvas = lazy(() => import("./MapCanvas"));
export function LocationMap({ lat, lon }: { lat: string; lon: string }) {
  const [open, setOpen] = useState(false),
    [copied, setCopied] = useState(false);
  return (
    <div className="location-map">
      <p className="field-help">
        Pickup coordinates: {lat}, {lon}
      </p>
      <div className="actions">
        <a
          className="button button-outline button-small"
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Directions
        </a>
        <button
          type="button"
          className="text-button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? "Hide map" : "Show map"}
        </button>
        <button
          type="button"
          className="text-button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${lat}, ${lon}`);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          Copy coordinates
        </button>
        {copied && <span role="status">Coordinates copied.</span>}
      </div>
      {open && (
        <Suspense fallback={<p role="status">Loading map…</p>}>
          <MapCanvas latitude={Number(lat)} longitude={Number(lon)} />
        </Suspense>
      )}
    </div>
  );
}
