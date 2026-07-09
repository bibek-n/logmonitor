import { getRecentAlerts } from "@/lib/alerts";
import HeaderClient from "./HeaderClient";

export default async function Header({ userName }: { userName: string }) {
  const alerts = await getRecentAlerts(5);
  return <HeaderClient userName={userName} alerts={alerts} />;
}
