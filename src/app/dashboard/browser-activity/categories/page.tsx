import { getBrowserActivitySession } from "@/lib/requireBrowserActivityPermission";
import { listCategories, listCategoryRules } from "@/lib/browserActivity/repository";
import { CategoriesClient } from "@/components/browserActivity/CategoriesClient";

export const dynamic = "force-dynamic";

export default async function BrowserActivityCategoriesPage() {
  const ba = await getBrowserActivitySession("ba_view");
  if (!ba) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Domain Categories</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view domain categories.</p>
      </div>
    );
  }

  const [categories, rules] = await Promise.all([listCategories(), listCategoryRules()]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Domain Categories</h1>
      <CategoriesClient categories={categories} rules={rules} />
    </div>
  );
}
