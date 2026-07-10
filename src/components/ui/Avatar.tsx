// Same circular initial-letter badge already used for the logged-in user's avatar in
// HeaderClient.tsx — reused here so "no photo yet" has one consistent look across the app
// instead of a second, different placeholder graphic.
export function Avatar({
  name,
  photoPath,
  size = 34,
}: {
  name: string;
  photoPath?: string | null;
  size?: number;
}) {
  if (photoPath) {
    return (
      <img
        src={photoPath}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          background: "var(--surface-2)",
        }}
      />
    );
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--primary)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}
