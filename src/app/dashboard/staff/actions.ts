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
    try {
      await db
        .request()
        .input("name", sql.NVarChar, name)
        .input("mac", sql.VarChar, mac || null)
        .query(`INSERT INTO Staff (Name, MacAddress) VALUES (@name, @mac)`);
    } catch {
      errorCode = "duplicateMac";
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
