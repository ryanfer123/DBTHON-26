import { useEffect, useState } from "react";
import { loadZones } from "../../lib/identity";

export function CommunityArea({ zoneId }: { zoneId: number }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ label: "", error: "", loading: true });
  useEffect(() => {
    const controller = new AbortController();
    loadZones(controller.signal)
      .then((zones) => {
        if (!controller.signal.aborted) {
          const zone = zones.find((item) => item.zone_id === zoneId);
          setState({
            loading: false,
            label: zone ? `${zone.zone_name} · ${zone.city}` : "",
            error: zone ? "" : "Area information is unavailable.",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, label: "", error: error.message });
      });
    return () => controller.abort();
  }, [zoneId, attempt]);
  return (
    <>
      {state.loading ? (
        <span>Loading area…</span>
      ) : state.error ? (
        <>
          <span>{state.error}</span>
          <br />
          <button
            className="text-button"
            onClick={() => {
              setState({ label: "", error: "", loading: true });
              setAttempt((value) => value + 1);
            }}
          >
            Retry area details
          </button>
        </>
      ) : (
        state.label
      )}
    </>
  );
}
