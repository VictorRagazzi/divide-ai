import { RequireProfile } from "../features/demo/Onboarding";
import TripsScreen from "../features/demo/TripsScreen";

export default function TripsScreenRoute() {
  return (
    <RequireProfile>
      <TripsScreen />
    </RequireProfile>
  );
}
