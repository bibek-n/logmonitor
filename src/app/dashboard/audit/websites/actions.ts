"use server";

import { getDb, sql } from "@/lib/db";
import { isValidUrl } from "@/lib/websiteTools";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const VALID_ENVIRONMENTS = new Set(["Live", "Staging", "Dev"]);

export async function addWebsite(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const environmentRaw = String(formData.get("environment") ?? "").trim();
  const environment = VALID_ENVIRONMENTS.has(environmentRaw) ? environmentRaw : "Live";

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
      .input("environment", sql.NVarChar, environment)
      .query(`INSERT INTO Websites (Name, Url, Environment) VALUES (@name, @url, @environment)`);
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

export async function updateWebsite(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const environmentRaw = String(formData.get("environment") ?? "").trim();
  const environment = VALID_ENVIRONMENTS.has(environmentRaw) ? environmentRaw : "Live";

  if (!id) return;

  let errorMessage: string | null = null;
  if (!name) {
    errorMessage = "Name is required.";
  } else if (!isValidUrl(url)) {
    errorMessage = "Enter a valid URL starting with http:// or https://";
  } else {
    const db = await getDb();
    await db
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.NVarChar, name)
      .input("url", sql.NVarChar, url)
      .input("environment", sql.NVarChar, environment)
      .query(`UPDATE Websites SET Name = @name, Url = @url, Environment = @environment WHERE Id = @id`);
  }

  revalidatePath("/dashboard/audit/websites");

  if (errorMessage) {
    redirect(`/dashboard/audit/websites?edit=${id}&error=${encodeURIComponent(errorMessage)}`);
  }
  redirect("/dashboard/audit/websites");
}

// Disabling (not deleting) is what every downstream tool — the other 4 audit tools and the
// Website Security Audit picker — filters on (`WHERE Enabled = 1`), so this is the single
// switch that "automatically reflects" everywhere per the feature's requirement.
export async function toggleWebsiteEnabled(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const db = await getDb();
  await db.request().input("id", sql.Int, id).query(`UPDATE Websites SET Enabled = CASE WHEN Enabled = 1 THEN 0 ELSE 1 END WHERE Id = @id`);

  revalidatePath("/dashboard/audit/websites");
  redirect("/dashboard/audit/websites");
}
