import { describe, it, expect } from "vitest";
import { parseSophosLog } from "./sophosParser";

// Captured live from the enrolled Sophos XGS126 (2026-07-21) via WebFilterLogs.RawMessage -
// pins the real field names this firewall's current firmware actually sends. Domain/Category/
// CategoryType were previously always null in production because the parser looked for
// domainname=/category=/category_type=, but this firmware sends domain=/http_category=/
// http_category_type= instead - this line is the evidence, not a guess.
const REAL_RAW_LINE =
  '<30>device_name="TULIP-TECHNOLOGIES" timestamp="2026-07-21T16:01:59+0545" device_model="XGS126" device_serial_id="X12304RK3JGC408" log_id="050901616001" log_type="Content Filtering" log_component="HTTP" log_subtype="Allowed" log_version=1 severity="Information" fw_rule_id="3" fw_rule_name="Traffic to WAN" fw_rule_section="Local rule" web_policy_id=14 http_category="Video hosting" http_category_type="Unproductive" url="https://i.ytimg.com" src_ip="192.168.1.12" dst_ip="74.125.68.119" protocol="TCP" src_port=48488 dst_port=443 bytes_sent=6703 bytes_received=79867 domain="i.ytimg.com" http_status="0" con_id=2186886336 app_name="Youtube Website" app_is_cloud="FALSE" used_quota="0" src_zone_type="LAN" src_zone="LAN" dst_zone_type="WAN" dst_zone="WAN" src_country="R1" dst_country="USA" app_risk=3 app_category="Streaming Media"';

describe("parseSophosLog", () => {
  it("extracts domain/category/categoryType from this firmware's real key names", () => {
    const p = parseSophosLog(REAL_RAW_LINE);
    expect(p.domain).toBe("i.ytimg.com");
    expect(p.category).toBe("Video hosting");
    expect(p.categoryType).toBe("Unproductive");
  });

  it("extracts Application Control fields and bandwidth", () => {
    const p = parseSophosLog(REAL_RAW_LINE);
    expect(p.application).toBe("Youtube Website");
    expect(p.applicationCategory).toBe("Streaming Media");
    expect(p.bytesSent).toBe(6703);
    expect(p.bytesReceived).toBe(79867);
  });

  it("falls back to splitting timestamp when date=/time= are absent", () => {
    const p = parseSophosLog(REAL_RAW_LINE);
    expect(p.logDate).toBe("2026-07-21");
    expect(p.logTime).toBe("16:01:59");
  });

  it("leaves application fields null when app_name/app_category are absent (unclassified flow)", () => {
    const noApp = REAL_RAW_LINE.replace(/ app_name="[^"]*"/, "").replace(/ app_category="[^"]*"/, "");
    const p = parseSophosLog(noApp);
    expect(p.application).toBeNull();
    expect(p.applicationCategory).toBeNull();
  });

  it("still reads the old domainname=/category= keys as a fallback", () => {
    const oldStyle =
      'date="2026-01-01" time="00:00:00" src_ip="1.2.3.4" domainname="old.example.com" category="Old Category" category_type="Old Type"';
    const p = parseSophosLog(oldStyle);
    expect(p.domain).toBe("old.example.com");
    expect(p.category).toBe("Old Category");
    expect(p.categoryType).toBe("Old Type");
  });
});
