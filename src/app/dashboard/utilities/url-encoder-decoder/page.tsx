import UrlEncoderDecoderForm from "@/components/utilities/UrlEncoderDecoderForm";

export default function UrlEncoderDecoderPage() {
  return (
    <div>
      <h1>URL Encoder/Decoder</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Encode or decode a URL or URL component (query string value, path segment, etc.).
      </p>
      <UrlEncoderDecoderForm />
    </div>
  );
}
