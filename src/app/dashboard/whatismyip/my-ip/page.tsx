import ToolForm from "@/components/ToolForm";

export default function MyIpPage() {
  return (
    <div>
      <h1>What Is My IP</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Shows this server&apos;s public-facing IP address, ISP, and approximate location — since this runs from
        the server (not your browser), it reflects what the internet sees for this server specifically.
      </p>
      <ToolForm endpoint="/api/whatismyip/my-ip" submitLabel="Check My IP" fields={[]} />
    </div>
  );
}
