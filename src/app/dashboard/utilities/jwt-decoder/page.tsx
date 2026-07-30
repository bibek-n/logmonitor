import JwtDecoderForm from "@/components/utilities/JwtDecoderForm";

export default function JwtDecoderPage() {
  return (
    <div>
      <h1>JWT Decoder</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Decode a JSON Web Token&apos;s header and payload entirely in your browser - the token never leaves this page.
      </p>
      <JwtDecoderForm />
    </div>
  );
}
