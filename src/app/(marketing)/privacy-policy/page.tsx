import type { Metadata } from "next";
import { MKT } from "@/lib/marketingTheme";

export const metadata: Metadata = { title: "Privacy Policy — Log Monitor" };

export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: MKT.ink, marginBottom: "1rem" }}>Privacy Policy</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "0.92rem", lineHeight: 1.7 }}>
        This placeholder privacy policy will be replaced with the finalized, legally-reviewed version. It should
        describe what data is collected (including any endpoint or staff monitoring data), how it is used, how
        long it is retained, and how individuals can exercise any applicable data rights.
      </p>
    </div>
  );
}
