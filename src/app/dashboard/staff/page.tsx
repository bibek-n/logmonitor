import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/lib/db";
import { addStaff } from "./actions";
import { getStaffWithStatus } from "@/lib/staffStatus";
import DeviceSelect from "@/components/DeviceSelect";
import { EmployeesTable, type EmployeeRow } from "@/components/staff/EmployeesTable";

export const dynamic = "force-dynamic";

interface AvailableDevice {
  IpAddress: string;
  MacAddress: string;
  Hostname: string | null;
  Source: "Mikrotik" | "Sophos";
}

function FilterTile({
  label,
  value,
  status,
  href,
  active,
}: {
  label: string;
  value: string | number;
  status: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`stat-tile status-${status}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        outline: active ? "2px solid var(--series-1)" : "none",
        outlineOffset: "-2px",
      }}
    >
      <div className="label">
        <span className={`status-dot status-${status}`} />
        {label}
      </div>
      <div className="value">{value}</div>
    </Link>
  );
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; type?: string; status?: string }>;
}) {
  const { error, type: typeFilter, status: statusFilter } = await searchParams;
  const t = await getTranslations("employees.list");

  // Builds a staff URL preserving whichever of the two filter dimensions (device type,
  // status) isn't being changed by this particular tile - so e.g. clicking "Online" while
  // "PC/Laptop" is already selected narrows to online PCs/laptops rather than clobbering it.
  function staffHref(overrides: { type?: string | null; status?: string | null }): string {
    const nextType = overrides.type !== undefined ? overrides.type : typeFilter;
    const nextStatus = overrides.status !== undefined ? overrides.status : statusFilter;
    const params = new URLSearchParams();
    if (nextType) params.set("type", nextType);
    if (nextStatus) params.set("status", nextStatus);
    const qs = params.toString();
    return qs ? `/dashboard/staff?${qs}` : "/dashboard/staff";
  }
  const ERROR_CODES = new Set(["nameRequired", "duplicateMac"]);
  const errorMessage = error && ERROR_CODES.has(error) ? t(`errors.${error}`) : null;
  const db = await getDb();

  const staff = await getStaffWithStatus();

  const profileResult = await db.query<{
    Id: number;
    Email: string | null;
    Phone: string | null;
    Department: string | null;
    Position: string | null;
    Address: string | null;
    PhotoPath: string | null;
    DepartmentId: number | null;
    TeamId: number | null;
    BranchOfficeId: number | null;
    JobDesignationId: number | null;
  }>(
    "SELECT Id, Email, Phone, Department, Position, Address, PhotoPath, DepartmentId, TeamId, BranchOfficeId, JobDesignationId FROM Staff"
  );
  const profileById = new Map(profileResult.recordset.map((p) => [p.Id, p]));
  const employees: EmployeeRow[] = staff.map((s) => {
    const profile = profileById.get(s.Id);
    return {
      ...s,
      ComputerNameOverride: s.computerNameOverride,
      Email: profile?.Email ?? null,
      Phone: profile?.Phone ?? null,
      Department: profile?.Department ?? null,
      Position: profile?.Position ?? null,
      Address: profile?.Address ?? null,
      PhotoPath: profile?.PhotoPath ?? null,
      DepartmentId: profile?.DepartmentId ?? null,
      TeamId: profile?.TeamId ?? null,
      BranchOfficeId: profile?.BranchOfficeId ?? null,
      JobDesignationId: profile?.JobDesignationId ?? null,
    };
  });

  const availableResult = await db.query<AvailableDevice>(`
    SELECT * FROM (
      SELECT IpAddress, MacAddress, Hostname, 'Mikrotik' AS Source
      FROM RouterClients
      WHERE MacAddress IS NOT NULL
        AND UPPER(MacAddress) NOT IN (SELECT UPPER(MacAddress) FROM Staff WHERE MacAddress IS NOT NULL)
      UNION ALL
      SELECT IpAddress, MacAddress, Hostname, 'Sophos' AS Source
      FROM SophosClients
      WHERE MacAddress IS NOT NULL
        AND UPPER(MacAddress) NOT IN (SELECT UPPER(MacAddress) FROM Staff WHERE MacAddress IS NOT NULL)
    ) combined
    ORDER BY Source,
      CAST(PARSENAME(IpAddress, 4) AS INT),
      CAST(PARSENAME(IpAddress, 3) AS INT),
      CAST(PARSENAME(IpAddress, 2) AS INT),
      CAST(PARSENAME(IpAddress, 1) AS INT)
  `);
  const available = availableResult.recordset;

  const online = employees.filter((s) => s.isOnline).length;
  const unassigned = employees.filter((s) => !s.MacAddress).length;
  const offline = employees.length - online - unassigned;

  // Device type only means something once a device is assigned, so counts/filter exclude
  // unassigned employees rather than lumping them into "Other".
  const assigned = employees.filter((s) => s.MacAddress);
  const pcCount = assigned.filter((s) => s.deviceType === "PC/Laptop").length;
  const mobileCount = assigned.filter((s) => s.deviceType === "Mobile").length;
  const otherCount = assigned.filter((s) => s.deviceType === "Other").length;

  const visibleEmployees = employees.filter((s) => {
    if (typeFilter && (!s.MacAddress || s.deviceType !== typeFilter)) return false;
    if (statusFilter === "online" && !s.isOnline) return false;
    if (statusFilter === "offline" && (!s.MacAddress || s.isOnline)) return false;
    if (statusFilter === "unassigned" && s.MacAddress) return false;
    return true;
  });

  const deviceTypeLabel =
    typeFilter === "PC/Laptop" ? t("pcLaptopLabel") : typeFilter === "Mobile" ? t("mobileLabel") : t("otherLabel");
  const hasActiveFilter = Boolean(typeFilter || statusFilter);

  return (
    <div>
      <h1>{t("pageTitle")}</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        {t.rich("intro", {
          strong: (chunks) => <strong>{chunks}</strong>,
          em: (chunks) => <em>{chunks}</em>,
        })}
      </p>

      {errorMessage && (
        <div
          style={{
            background: "var(--critical)",
            color: "#fff",
            padding: "0.6rem 0.75rem",
            borderRadius: 8,
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {errorMessage}
        </div>
      )}

      <div className="stat-grid">
        <FilterTile
          label={t("totalEmployeesLabel")}
          value={employees.length}
          status="unknown"
          href={staffHref({ type: null, status: null })}
          active={!hasActiveFilter}
        />
        <FilterTile
          label={t("onlineLabel")}
          value={online}
          status={online > 0 ? "good" : "unknown"}
          href={staffHref({ status: statusFilter === "online" ? null : "online" })}
          active={statusFilter === "online"}
        />
        <FilterTile
          label={t("offlineLabel")}
          value={offline}
          status={offline > 0 ? "warning" : "good"}
          href={staffHref({ status: statusFilter === "offline" ? null : "offline" })}
          active={statusFilter === "offline"}
        />
        <FilterTile
          label={t("unassignedDeviceLabel")}
          value={unassigned}
          status={unassigned > 0 ? "warning" : "good"}
          href={staffHref({ status: statusFilter === "unassigned" ? null : "unassigned" })}
          active={statusFilter === "unassigned"}
        />
      </div>

      <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginBottom: "0.4rem" }}>
        {t("filterByDeviceTypeHint")}
      </p>
      <div className="stat-grid">
        <FilterTile
          label={t("allDevicesLabel")}
          value={assigned.length}
          status="unknown"
          href={staffHref({ type: null })}
          active={!typeFilter}
        />
        <FilterTile
          label={t("pcLaptopLabel")}
          value={pcCount}
          status={typeFilter === "PC/Laptop" ? "good" : "unknown"}
          href={staffHref({ type: typeFilter === "PC/Laptop" ? null : "PC/Laptop" })}
          active={typeFilter === "PC/Laptop"}
        />
        <FilterTile
          label={t("mobileLabel")}
          value={mobileCount}
          status={typeFilter === "Mobile" ? "good" : "unknown"}
          href={staffHref({ type: typeFilter === "Mobile" ? null : "Mobile" })}
          active={typeFilter === "Mobile"}
        />
        <FilterTile
          label={t("otherLabel")}
          value={otherCount}
          status={typeFilter === "Other" ? "good" : "unknown"}
          href={staffHref({ type: typeFilter === "Other" ? null : "Other" })}
          active={typeFilter === "Other"}
        />
      </div>

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>{t("addEmployeeTitle")}</h2>
        <form action={addStaff} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <label htmlFor="name">{t("nameLabel")}</label>
            <input id="name" name="name" type="text" required placeholder={t("namePlaceholder")} />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 320px" }}>
            <label htmlFor="mac">{t("deviceLabel")}</label>
            <DeviceSelect devices={available} />
          </div>
          <button className="submit" type="submit" style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
            {t("addButton")}
          </button>
        </form>
      </div>

      <div className="dash-panel">
        {employees.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>{t("noEmployeesYetEmptyState")}</p>
        ) : visibleEmployees.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            {typeFilter ? t("noEmployeesWithDeviceType", { deviceType: deviceTypeLabel }) : t("noEmployeesMatchFilter")}{" "}
            <Link href={staffHref({ type: null, status: null })} style={{ color: "var(--series-1)" }}>
              {t("clearFilterLink")}
            </Link>
          </p>
        ) : (
          <EmployeesTable employees={visibleEmployees} />
        )}
      </div>
    </div>
  );
}
