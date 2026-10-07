import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/maps.css";

export type MapPoint = {
  id: number;
  latitude: number;
  longitude: number;
  label: string;
  urgent?: boolean;
};
type Props = {
  latitude: number;
  longitude: number;
  radius?: number;
  points?: MapPoint[];
  selected?: number | null;
  onSelect?: (id: number) => void;
  onChange?: (latitude: string, longitude: string) => void;
  onTileError?: () => void;
};
export default function MapCanvas({
  latitude,
  longitude,
  radius,
  points,
  selected,
  onSelect,
  onChange,
  onTileError,
}: Props) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<L.LayerGroup | null>(null);
  const change = useRef(onChange),
    select = useRef(onSelect),
    tileError = useRef(onTileError);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    change.current = onChange;
    select.current = onSelect;
    tileError.current = onTileError;
  }, [onChange, onSelect, onTileError]);
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, { scrollWheelZoom: false }).setView(
      [latitude, longitude],
      14,
    );
    map.current = instance;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })
      .on("tileerror", () => {
        setFailed(true);
        tileError.current?.();
      })
      .addTo(instance);
    layers.current = L.layerGroup().addTo(instance);
    instance.on("click", (event: L.LeafletMouseEvent) =>
      change.current?.(
        event.latlng.lat.toFixed(6),
        event.latlng.lng.toFixed(6),
      ),
    );
    return () => {
      instance.remove();
      map.current = null;
      layers.current = null;
    };
    // Initial center is followed by the synchronized layer effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const instance = map.current,
      group = layers.current;
    if (!instance || !group) return;
    group.clearLayers();
    instance.panTo([latitude, longitude], { animate: false });
    if (radius)
      L.circle([latitude, longitude], {
        radius,
        color: "#36755c",
        fillOpacity: 0.06,
      }).addTo(group);
    if (points) {
      for (const point of points) {
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: point.id === selected ? 13 : 9,
          color: point.urgent ? "#743b0c" : "#174334",
          fillColor: point.urgent ? "#ffdfad" : "#dcf0e1",
          fillOpacity: 1,
          weight: point.id === selected ? 4 : 2,
        }).addTo(group);
        const label = document.createElement("span");
        label.textContent = `${point.urgent ? "◷ Ending soon · " : ""}${point.label}`;
        marker.bindTooltip(label).on("click", () => select.current?.(point.id));
      }
    } else {
      const marker = L.marker([latitude, longitude], {
        draggable: Boolean(onChange),
        icon: L.divIcon({
          className: "location-pin",
          html: '<span aria-hidden="true">●</span>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(group);
      marker.on("dragend", () => {
        const point = marker.getLatLng();
        change.current?.(point.lat.toFixed(6), point.lng.toFixed(6));
      });
    }
  }, [latitude, longitude, radius, points, selected, onChange]);
  return (
    <div>
      <div
        className="map-canvas"
        ref={element}
        role="region"
        aria-label="Pickup map. Use coordinate fields or listing buttons for keyboard access."
      />
      {failed && (
        <p className="notice" role="status">
          Map tiles could not load. Use the coordinate fields or the text
          listings below; every action remains available.
        </p>
      )}
    </div>
  );
}
