import { RequireProfile } from "../features/demo/Onboarding";
import ProfileScreen from "../features/demo/ProfileScreen";

export default function ProfileScreenRoute() {
  return (
    <RequireProfile>
      <ProfileScreen />
    </RequireProfile>
  );
}
