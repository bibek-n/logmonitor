import CronTesterForm from "@/components/utilities/CronTesterForm";

export default function CronTesterPage() {
  return (
    <div>
      <h1>Cron Expression Tester</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Enter a standard 5-field cron expression (minute hour day-of-month month day-of-week) to preview its next 10 run
        times.
      </p>
      <CronTesterForm />
    </div>
  );
}
