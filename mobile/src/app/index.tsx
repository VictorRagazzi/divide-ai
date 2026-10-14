import { RequireProfile } from "../features/demo/Onboarding";
import SearchScreen from "../features/demo/SearchScreen";

export default function SearchScreenRoute() {
  return (
    <RequireProfile>
      <SearchScreen />
    </RequireProfile>
  );
}
