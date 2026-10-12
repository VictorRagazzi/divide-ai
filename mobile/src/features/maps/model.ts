export type Endpoint = "origin" | "destination";
export type Point = { latitude: number; longitude: number };
export type MapPoints = Record<Endpoint, Point>;
export type MapProps = {
  points: Partial<MapPoints>;
  selected?: Endpoint;
  editable?: boolean;
  topInset?: number;
  onSelect?: (endpoint: Endpoint, point: Point) => void;
};

export const initialPoints: MapPoints = {
  origin: { latitude: -19.932, longitude: -43.938 },
  destination: { latitude: -19.925, longitude: -43.942 },
};

export function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Point>;
  return (
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 85.05112878 &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}

export function coordinates(point: Point) {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}

export type MapMessage =
  | { type: "ready" }
  | { type: "selection"; endpoint: Endpoint; point: Point };

export function readMessage(raw: unknown): MapMessage | null {
  if (typeof raw !== "string" || raw.length > 512) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    if (value.type === "ready") return { type: "ready" };
    if (
      value.type === "selection" &&
      (value.endpoint === "origin" || value.endpoint === "destination") &&
      isPoint(value.point)
    )
      return {
        type: "selection",
        endpoint: value.endpoint,
        point: value.point,
      };
  } catch {
    // Ignore untrusted or incomplete bridge messages.
  }
  return null;
}

export function mapUpdate(props: MapProps) {
  return JSON.stringify({
    type: "update",
    points: props.points,
    selected: props.selected ?? "origin",
    editable: props.editable ?? false,
    topInset: props.topInset ?? 0,
  }).replaceAll("<", "\\u003c");
}
