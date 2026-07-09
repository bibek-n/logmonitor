import SpeedTestForm from "@/components/SpeedTestForm";
import { NEPAL_SERVERS } from "@/lib/speedTest";

export default function NepalSpeedTestPage() {
  return (
    <div>
      <h1>Nepal Server Speed Test</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Measures ping, download, and upload speed from this server to a real ISP speed-test server in Nepal,
        updating live as the test runs. These are the actual dedicated speed-test servers each ISP runs (the same
        ones desktop/mobile Speedtest apps use) — Nepal Telecom, WorldLink, Subisu, Ncell, DishHome, ClassicTech,
        HONS, and Islington College — so both download and upload are accurate, not approximated.
      </p>
      <SpeedTestForm category="nepal" servers={NEPAL_SERVERS} />
    </div>
  );
}
