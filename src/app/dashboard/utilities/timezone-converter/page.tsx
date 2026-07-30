import TimezoneConverterForm from "@/components/utilities/TimezoneConverterForm";

export default function TimezoneConverterPage() {
  return (
    <div>
      <h1>Time Zone Converter</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Convert a date and time from one time zone to a set of commonly used time zones.
      </p>
      <TimezoneConverterForm />
    </div>
  );
}
