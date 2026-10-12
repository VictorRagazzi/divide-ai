import type { Place } from "./geocoder.ts";
import { type Endpoint, isPoint, type MapPoints, type Point } from "./model.ts";

export type SelectedPlace = { label: string; point: Point };
export type PlaceField = {
  text: string;
  place: SelectedPlace | null;
  revision: number;
};
export type PlacesState = Record<Endpoint, PlaceField>;
export const emptyPlaces: PlacesState = {
  origin: { text: "", place: null, revision: 0 },
  destination: { text: "", place: null, revision: 0 },
};
export type PlaceCommand =
  | { type: "edit"; endpoint: Endpoint; text: string }
  | { type: "select"; endpoint: Endpoint; place: SelectedPlace | Place }
  | { type: "resolve"; endpoint: Endpoint; revision: number; label: string };
export function changePlace(
  state: PlacesState,
  command: PlaceCommand,
): PlacesState {
  const current = state[command.endpoint];
  let field: PlaceField;
  if (command.type === "edit")
    field = {
      text: command.text.slice(0, 160),
      place: null,
      revision: current.revision + 1,
    };
  else if (command.type === "select") {
    if (!isPoint(command.place.point) || !command.place.label.trim())
      return state;
    field = {
      text: command.place.label,
      place: { label: command.place.label, point: command.place.point },
      revision: current.revision + 1,
    };
  } else {
    if (
      !current.place ||
      current.revision !== command.revision ||
      !command.label.trim()
    )
      return state;
    field = {
      ...current,
      text: command.label,
      place: { ...current.place, label: command.label },
    };
  }
  return { ...state, [command.endpoint]: field };
}
export function selectedPoints(state: PlacesState): Partial<MapPoints> {
  return {
    ...(state.origin.place ? { origin: state.origin.place.point } : {}),
    ...(state.destination.place
      ? { destination: state.destination.place.point }
      : {}),
  };
}
export function confirmedTrip(
  state: PlacesState,
): { origin: string; destination: string; points: MapPoints } | null {
  if (!state.origin.place || !state.destination.place) return null;
  const origin = state.origin.place;
  const destination = state.destination.place;
  if (
    origin.point.latitude === destination.point.latitude &&
    origin.point.longitude === destination.point.longitude
  )
    return null;
  return {
    origin: origin.label,
    destination: destination.label,
    points: { origin: origin.point, destination: destination.point },
  };
}
