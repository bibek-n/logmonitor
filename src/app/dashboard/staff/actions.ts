"use server";

import { getDb, sql } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addStaff(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const mac = String(formData.get("mac") ?? "").trim().toUpperCase();

  let errorMessage: string | null = null;

  if (!name) {
    errorMessage = "Name is required.";
  } else {
    const db = await getDb();
    try {
      await db
        .request()
        .input("name", sql.NVarChar, name)
        .input("mac", sql.VarChar, mac || null)
        .query(`INSERT INTO Staff (Name, MacAddress) VALUES (@name, @mac)`);
    } catch {
      errorMessage = "That MAC address is already assigned to another staff member.";
    }
  }

  revalidatePath("/dashboard/staff");

  if (errorMessage) {
    redirect(`/dashboard/staff?error=${encodeURIComponent(errorMessage)}`);
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
