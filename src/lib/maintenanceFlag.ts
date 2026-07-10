// Name/value of the plain (non-httpOnly) cookie that src/middleware.ts checks to decide
// whether to show the maintenance page. Middleware runs on the Edge runtime (see
// src/middleware.ts), where the `mssql` driver cannot connect — so the cookie, not a direct
// DB read, is the source of truth for middleware. src/app/api/admin/settings/system/route.ts
// writes this cookie every time CompanySettings.MaintenanceModeEnabled is saved, so the two
// stay in sync without middleware ever touching the database.
export const MAINTENANCE_COOKIE = "lm_maintenance";
