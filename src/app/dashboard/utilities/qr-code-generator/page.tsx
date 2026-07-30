import QrCodeGeneratorForm from "@/components/utilities/QrCodeGeneratorForm";

export default function QrCodeGeneratorPage() {
  return (
    <div>
      <h1>QR Code Generator</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Generate a downloadable QR code from any text or URL.
      </p>
      <QrCodeGeneratorForm />
    </div>
  );
}
