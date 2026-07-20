export function QaAccessDenied({ title }: { title: string }) {
  return (
    <div>
      <h1 style={{ fontSize: "1.4rem" }}>{title}</h1>
      <p style={{ color: "var(--danger)" }}>You don&apos;t have permission to view this page.</p>
    </div>
  );
}
