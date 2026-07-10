import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Reorders via simple adjacent-swap on SortOrder — chosen over drag-and-drop for
// reliability/accessibility/zero new dependencies (see the approved plan), while still
// fully satisfying "change slider display order".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const slideId = Number(id);
  const body = await req.json().catch(() => null);
  const direction = body?.direction;
  if (!Number.isInteger(slideId) || (direction !== "up" && direction !== "down")) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  const currentResult = await db.request().input("id", sql.Int, slideId).query<{ SortOrder: number }>(
    "SELECT SortOrder FROM SliderImages WHERE Id = @id"
  );
  const current = currentResult.recordset[0];
  if (!current) {
    return NextResponse.json({ ok: false, error: "Slide not found" }, { status: 404 });
  }

  const neighborQuery =
    direction === "up"
      ? "SELECT TOP 1 Id, SortOrder FROM SliderImages WHERE SortOrder < @sortOrder ORDER BY SortOrder DESC"
      : "SELECT TOP 1 Id, SortOrder FROM SliderImages WHERE SortOrder > @sortOrder ORDER BY SortOrder ASC";

  const neighborResult = await db.request().input("sortOrder", sql.Int, current.SortOrder).query<{ Id: number; SortOrder: number }>(
    neighborQuery
  );
  const neighbor = neighborResult.recordset[0];
  if (!neighbor) {
    return NextResponse.json({ ok: true }); // already at the top/bottom — no-op, not an error
  }

  await db
    .request()
    .input("id", sql.Int, slideId)
    .input("neighborId", sql.Int, neighbor.Id)
    .input("currentOrder", sql.Int, current.SortOrder)
    .input("neighborOrder", sql.Int, neighbor.SortOrder)
    .query(`
      UPDATE SliderImages SET SortOrder = @neighborOrder WHERE Id = @id;
      UPDATE SliderImages SET SortOrder = @currentOrder WHERE Id = @neighborId;
    `);

  return NextResponse.json({ ok: true });
}
