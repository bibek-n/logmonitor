import type { Metadata } from "next";
import { MKT } from "@/lib/marketingTheme";

export const metadata: Metadata = { title: "Terms & Conditions — Log Monitor" };

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: MKT.ink, marginBottom: "1rem" }}>Terms &amp; Conditions</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "0.92rem", lineHeight: 1.7 }}>
        This placeholder will be replaced with finalized, legally-reviewed terms of service governing use of this
        platform.
      </p>
    </div>
  );
}
