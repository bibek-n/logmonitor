import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, HelpCircle, FileText, Mail, Ticket } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import { SUPPORT_RESOURCES, CONTACT_INFO } from "@/lib/websiteContent";

export const metadata: Metadata = {
  title: "Support — Log Monitor",
  description: "Knowledge base, FAQs, guides, and support ticket access for Log Monitor.",
};

function OptionCard({ icon: Icon, title, description, href, linkLabel }: { icon: typeof BookOpen; title: string; description: string; href: string; linkLabel: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
      <Icon size={26} style={{ color: MKT.primary, marginBottom: "0.75rem" }} />
      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.4rem" }}>{title}</h3>
      <p style={{ fontSize: "0.88rem", color: MKT.inkMuted, marginBottom: "0.9rem", lineHeight: 1.55 }}>{description}</p>
      <Link href={href} style={{ color: MKT.primary, fontWeight: 600, fontSize: "0.88rem", textDecoration: "none" }}>
        {linkLabel} →
      </Link>
    </div>
  );
}

export default function SupportPage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>Support</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 720 }}>
        Find answers below, or submit a support ticket and our team will help you directly.
      </p>

      <div className="grid gap-5 mb-10" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <OptionCard icon={BookOpen} title="Knowledge Base" description="Guides and articles covering the platform's core features." href="#guides" linkLabel="Browse guides" />
        <OptionCard icon={HelpCircle} title="FAQ" description="Answers to the questions we hear most often." href="#faq" linkLabel="View FAQs" />
        <OptionCard icon={Ticket} title="Submit a Ticket" description="Get direct help from our support team." href="/support/tickets/new" linkLabel="Create ticket" />
        <OptionCard icon={FileText} title="Check Ticket Status" description="Track a ticket you already submitted." href="/support/tickets/status" linkLabel="Check status" />
      </div>

      <h2 id="guides" style={{ fontSize: "1.3rem", fontWeight: 700, color: MKT.ink, marginBottom: "1rem" }}>
        User Guides
      </h2>
      <ul style={{ marginBottom: "2.5rem", paddingLeft: "1.25rem", color: MKT.inkMuted, fontSize: "0.95rem", lineHeight: 1.9 }}>
        {SUPPORT_RESOURCES.guides.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>

      <h2 id="faq" style={{ fontSize: "1.3rem", fontWeight: 700, color: MKT.ink, marginBottom: "1rem" }}>
        Frequently Asked Questions
      </h2>
      <div className="flex flex-col gap-4 mb-10">
        {SUPPORT_RESOURCES.faqs.map((f) => (
          <div key={f.question} style={{ borderBottom: `1px solid ${MKT.border}`, paddingBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.4rem" }}>{f.question}</h3>
            <p style={{ fontSize: "0.9rem", color: MKT.inkMuted, margin: 0, lineHeight: 1.6 }}>{f.answer}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2" style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>
        <Mail size={16} /> Still need help? Email us at{" "}
        <a href={`mailto:${CONTACT_INFO.email}`} style={{ color: MKT.primary }}>
          {CONTACT_INFO.email}
        </a>
      </div>
    </div>
  );
}
