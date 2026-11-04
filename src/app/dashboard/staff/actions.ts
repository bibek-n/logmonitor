"use server";

import { getDb, sql } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addStaff(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const mac = String(formData.get("mac") ?? "").trim().toUpperCase();

  let errorCode: string | null = null;

  if (!name) {
    errorCode = "nameRequired";
  } else {
    const db = await getDb();
    let newStaffId: number | null = null;
    try {
      const insertResult = await db
        .request()
        .input("name", sql.NVarChar, name)
        .input("mac", sql.VarChar, mac || null)
        .query<{ Id: number }>(`INSERT INTO Staff (Name, MacAddress) OUTPUT INSERTED.Id VALUES (@name, @mac)`);
      newStaffId = insertResult.recordset[0].Id;
    } catch (err) {
      // Only the actual MAC-uniqueness violation is "duplicateMac" - anything else (a
      // transient DB error, a truncation, etc.) used to get mislabeled as a duplicate too,
      // which was misleading. Same detection technique as DuplicateStaffMacError in
      // activeDirectorySync.ts.
      errorCode = err instanceof Error && err.message.includes("UX_Staff_MacAddress") ? "duplicateMac" : "saveFailed";
    }

    // If this employee's MAC already belongs to an enrolled-but-unassigned device, link it
    // immediately — the mirror of the suggested-match flow on the device's own detail page
    // (src/lib/deviceMatch.ts), so an admin doesn't have to visit that page manually.
    if (newStaffId && mac) {
      await db
        .request()
        .input("staffId", sql.Int, newStaffId)
        .input("mac", sql.VarChar, mac)
        .query(`UPDATE Devices SET StaffId = @staffId WHERE MacAddress = @mac AND StaffId IS NULL`);
    }
  }

  revalidatePath("/dashboard/staff");

  if (errorCode) {
    redirect(`/dashboard/staff?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/dashboard/staff");
}

export async function removeStaff(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const db = await getDb();
  let errorCode: string | null = null;
  try {
    // Several tables reference Staff(Id) with no ON DELETE action (Assets.LinkedStaffId,
    // Devices.StaffId, WacWebsiteRules.StaffId, WifiAllowedDevices.StaffId), unlike
    // ChatMessages/EmployeeNotifications (CASCADE) or EnrollmentTokens (SET NULL) which
    // already clean themselves up. Removing an employee shouldn't destroy or be blocked by
    // their assigned asset/device/access-rule records - those stay in inventory, just
    // unassigned - so each is explicitly unlinked here before the delete, which used to fail
    // outright with an unhandled REFERENCE constraint violation (an uncaught DB error ->
    // crashed page) the moment an employee had so much as one linked asset.
    await db.request().input("id", sql.Int, id).query(`UPDATE Assets SET LinkedStaffId = NULL WHERE LinkedStaffId = @id`);
    await db.request().input("id", sql.Int, id).query(`UPDATE Devices SET StaffId = NULL WHERE StaffId = @id`);
    await db.request().input("id", sql.Int, id).query(`UPDATE WacWebsiteRules SET StaffId = NULL WHERE StaffId = @id`);
    await db.request().input("id", sql.Int, id).query(`UPDATE WifiAllowedDevices SET StaffId = NULL WHERE StaffId = @id`);
    await db.request().input("id", sql.Int, id).query(`DELETE FROM Staff WHERE Id = @id`);
  } catch (err) {
    // Safety net for any other/future FK reference to Staff not covered above - surfaces a
    // clean, translated error instead of the generic server-exception crash page. Logged
    // server-side (not just swallowed) so a genuinely new blocking reference is diagnosable
    // instead of silently reporting "removeFailed" with nothing to go on.
    console.error("[removeStaff] failed to remove staff id", id, ":", err instanceof Error ? err.message : err);
    errorCode = "removeFailed";
  }

  revalidatePath("/dashboard/staff");
  if (errorCode) {
    redirect(`/dashboard/staff?error=${encodeURIComponent(errorCode)}`);
  }
  redirect("/dashboard/staff");
}

