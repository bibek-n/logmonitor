import { getRecentAlerts } from "@/lib/alerts";
import HeaderClient from "./HeaderClient";
import type { DisplaySettings } from "@/lib/dateFormat";

export default async function Header({ userName, displaySettings }: { userName: string; displaySettings: DisplaySettings }) {
  const alerts = await getRecentAlerts(5);
  return <HeaderClient userName={userName} alerts={alerts} displaySettings={displaySettings} />;
}
