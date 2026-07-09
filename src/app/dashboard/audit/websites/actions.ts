"use server";

import { getDb, sql } from "@/lib/db";
import { isValidUrl } from "@/lib/websiteTools";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function addWebsite(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();

  let errorMessage: string | null = null;

  if (!name) {
    errorMessage = "Name is required.";
  } else if (!isValidUrl(url)) {
    errorMessage = "Enter a valid URL starting with http:// or https://";
  } else {
    const db = await getDb();
    await db
      .request()
      .input("name", sql.NVarChar, name)
      .input("url", sql.NVarChar, url)
      .query(`INSERT INTO Websites (Name, Url) VALUES (@name, @url)`);
  }

  revalidatePath("/dashboard/audit/websites");

  if (errorMessage) {
    redirect(`/dashboard/audit/websites?error=${encodeURIComponent(errorMessage)}`);
  }
  redirect("/dashboard/audit/websites");
}

export async function removeWebsite(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const db = await getDb();
  await db.request().input("id", sql.Int, id).query(`DELETE FROM Websites WHERE Id = @id`);

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}
