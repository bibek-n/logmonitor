import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" && body.phone ? body.phone.trim() : null;
  const subject = typeof body.subject === "string" && body.subject ? body.subject.trim() : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return NextResponse.json({ ok: false, error: "Name, email, and message are required." }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("email", sql.NVarChar, email)
    .input("phone", sql.VarChar, phone)
    .input("subject", sql.NVarChar, subject)
    .input("message", sql.NVarChar, message)
    .query("INSERT INTO ContactMessages (Name, Email, Phone, Subject, Message) VALUES (@name, @email, @phone, @subject, @message)");

  return NextResponse.json({ ok: true });
}
