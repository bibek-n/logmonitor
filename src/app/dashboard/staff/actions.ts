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
    } catch {
      errorCode = "duplicateMac";
    }

    // If this employee's MAC already belongs to an enrolled-but-unassigned device, link it
    // immediately — the mirror of the suggested-match flow on the device's own detail page
    // (src/lib/deviceMatch.ts), so an admin doesn't have to visit that page manually.
    if (newStaffId && mac) {
      await db
        .request()
        .input("staffId", sql.Int, newStaffId)
        .input("mac", sql.VarChar, mac)
        .query(`UPDATE Devices SET StaffId = @staffId WHERE UPPER(MacAddress) = UPPER(@mac) AND StaffId IS NULL`);
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
  await db.request().input("id", sql.Int, id).query(`DELETE FROM Staff WHERE Id = @id`);

  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff");
}
