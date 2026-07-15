export type DeviceType = "PC/Laptop" | "Mobile" | "Other";

// Checked first: many modern phones randomize their MAC address for privacy (Android 10+,
// iOS), so OUI vendor lookup often comes back empty for exactly the devices we most want
// to identify. Hostnames from DHCP/NetBIOS are far more reliable when they're descriptive.
const HOSTNAME_MOBILE = /pixel|galaxy|redmi|poco\b|infinix|tecno\b|itel\b|oneplus|realme|\boppo\b|\bvivo\b|iphone|honor|nokia|moto\b|motorola|xiaomi|\bmi[- ]?\d|huawei|nexus/i;
const HOSTNAME_PC = /desktop-|-pc$|\bpc$|laptop|notebook|-air$|macbook|thinkpad|latitude|inspiron|pavilion|elitebook|probook|surface|ideapad|vostro|precision|zbook|chromebook/i;

// Fallback when hostname gives no signal: vendor OUI lookup. Ordered rules — more
// specific patterns first (e.g. "Lenovo Mobile" before plain "Lenovo").
const VENDOR_RULES: { pattern: RegExp; type: DeviceType }[] = [
  // --- Mobile (phones/tablets) ---
  { pattern: /lenovo mobile/i, type: "Mobile" },
  { pattern: /nokia mobile/i, type: "Mobile" },
  { pattern: /sony mobile/i, type: "Mobile" },
  { pattern: /samsung electronics/i, type: "Mobile" },
  { pattern: /xiaomi/i, type: "Mobile" },
  { pattern: /huawei/i, type: "Mobile" },
  { pattern: /\boppo\b/i, type: "Mobile" },
  { pattern: /vivo mobile/i, type: "Mobile" },
  { pattern: /oneplus/i, type: "Mobile" },
  { pattern: /realme/i, type: "Mobile" },
  { pattern: /motorola mobility/i, type: "Mobile" },
  { pattern: /transsion|infinix|tecno|itel mobile/i, type: "Mobile" },
  { pattern: /\bzte\b/i, type: "Mobile" },
  { pattern: /\bhtc\b/i, type: "Mobile" },
  { pattern: /honor device/i, type: "Mobile" },
  { pattern: /meizu/i, type: "Mobile" },
  { pattern: /google/i, type: "Mobile" }, // Pixel phones most common case for us

  // --- PC/Laptop ---
  { pattern: /dell/i, type: "PC/Laptop" },
  { pattern: /hewlett packard|hp inc/i, type: "PC/Laptop" },
  { pattern: /lenovo/i, type: "PC/Laptop" }, // plain "Lenovo" (not "Lenovo Mobile") = PC
  { pattern: /asustek|asus/i, type: "PC/Laptop" },
  { pattern: /acer inc/i, type: "PC/Laptop" },
  { pattern: /intel corporate/i, type: "PC/Laptop" },
  { pattern: /microsoft corporation/i, type: "PC/Laptop" },
  { pattern: /toshiba/i, type: "PC/Laptop" },
  { pattern: /micro-star|msi\b/i, type: "PC/Laptop" },
  { pattern: /gigabyte/i, type: "PC/Laptop" },
  { pattern: /fujitsu/i, type: "PC/Laptop" },
  { pattern: /liteon/i, type: "PC/Laptop" }, // common laptop WiFi/NIC OEM
  { pattern: /^apple/i, type: "PC/Laptop" }, // no hostname signal + Apple vendor: assume Mac
  // Contract ODMs that build laptops for the big brands above - their own MAC OUI shows up
  // directly (not relabeled as "Dell"/"HP"/etc.) often enough on our network to be worth
  // naming explicitly, rather than silently falling through to "Other".
  { pattern: /wistron/i, type: "PC/Laptop" },
  { pattern: /pegatron/i, type: "PC/Laptop" },
  { pattern: /quanta computer/i, type: "PC/Laptop" },
  { pattern: /compal/i, type: "PC/Laptop" },
  { pattern: /clevo|shenzhen kaifa/i, type: "PC/Laptop" },

  // --- Other (networking / IoT / peripherals) ---
  { pattern: /tp-link/i, type: "Other" },
  { pattern: /netgear/i, type: "Other" },
  { pattern: /d-link/i, type: "Other" },
  { pattern: /ubiquiti/i, type: "Other" },
  { pattern: /cisco/i, type: "Other" },
  { pattern: /ruckus|ruijie/i, type: "Other" },
  { pattern: /espressif/i, type: "Other" },
  { pattern: /raspberry pi/i, type: "Other" },
  { pattern: /amazon technologies/i, type: "Other" },
  { pattern: /sonos/i, type: "Other" },
  { pattern: /hikvision|dahua/i, type: "Other" },
  { pattern: /canon|epson|brother industries/i, type: "Other" },
  { pattern: /zebra technologies/i, type: "Other" },
];

export function classifyDevice(hostname: string | null, vendorName: string | null): DeviceType {
  if (hostname) {
    if (HOSTNAME_MOBILE.test(hostname)) return "Mobile";
    if (HOSTNAME_PC.test(hostname)) return "PC/Laptop";
  }
  if (vendorName) {
    for (const rule of VENDOR_RULES) {
      if (rule.pattern.test(vendorName)) return rule.type;
    }
  }
  return "Other";
}

export function macPrefix(mac: string): string {
  return mac.replace(/[:-]/g, "").toUpperCase().slice(0, 6);
}

const HOSTNAME_IOS = /iphone|ipad/i;
const HOSTNAME_ANDROID = /pixel|galaxy|redmi|poco\b|infinix|tecno\b|itel\b|oneplus|realme|\boppo\b|\bvivo\b|honor|xiaomi|huawei|nexus/i;
const HOSTNAME_MACOS = /-air$|macbook|imac|mac-?mini|mac-?pro/i;
const HOSTNAME_WINDOWS = /desktop-|-pc$|\bpc$|laptop|notebook|thinkpad|latitude|inspiron|pavilion|elitebook|probook|surface|ideapad|vostro|precision|zbook/i;

// Best-effort only: hostname naming conventions first, then the TTL of a ping reply as a
// fallback. Every OS decrements TTL from a fixed starting value per hop (Windows starts at
// 128, Linux/macOS/most mobile OSes start at 64, many routers/network gear start at 255) —
// this is the same passive fingerprinting trick used by tools like p0f, just applied to a
// single ping instead of a packet capture. It can't tell Windows 10 from 11, or distinguish
// two Unix-like OSes from each other, and a WAN hop or two will shift the observed number.
export function classifyOS(hostname: string | null, ttl: number | null): string {
  if (hostname) {
    if (HOSTNAME_IOS.test(hostname)) return "iOS";
    if (HOSTNAME_ANDROID.test(hostname)) return "Android";
    if (HOSTNAME_MACOS.test(hostname)) return "macOS";
    if (HOSTNAME_WINDOWS.test(hostname)) return "Windows";
  }
  if (ttl !== null) {
    if (ttl > 128) return "Network Device";
    if (ttl > 64) return "Windows";
    if (ttl > 0) return "Linux/macOS/Mobile";
  }
  return "Unknown";
}
