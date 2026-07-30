import SslDecoderForm from "@/components/utilities/SslDecoderForm";

export default function SslDecoderPage() {
  return (
    <div>
      <h1>SSL Decoder</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Paste a PEM-encoded certificate to decode its subject, issuer, validity dates, and fingerprints offline - no live
        connection is made. For checking a live server&apos;s certificate instead, use the SSL/TLS Certificate Checker under
        Audit Websites &amp; SSL Certificates.
      </p>
      <SslDecoderForm />
    </div>
  );
}
