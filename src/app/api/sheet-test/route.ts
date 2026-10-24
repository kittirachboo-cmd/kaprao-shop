import { NextResponse, type NextRequest } from "next/server";
import { postSheet } from "@/lib/notify";

/**
 * เช็กว่าเว็บต่อ Google Sheet ได้ไหม
 * เปิด /api/sheet-test?secret=<GOOGLE_SHEET_SECRET> ในเบราว์เซอร์
 */
export async function GET(req: NextRequest) {
  const secret = process.env.GOOGLE_SHEET_SECRET;
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json(
      { ok: false, error: secret ? "secret ไม่ถูก" : "ยังไม่ได้ตั้ง GOOGLE_SHEET_SECRET ใน Vercel" },
      { status: 401 },
    );
  }
  if (!url) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้ง GOOGLE_SHEET_WEBHOOK_URL ใน Vercel" });
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
    return NextResponse.json({
      ok: false,
      error: "GOOGLE_SHEET_WEBHOOK_URL ต้องเป็น Web app URL รูปแบบ https://script.google.com/macros/s/.../exec",
    });
  }
  try {
    const body = await postSheet({ action: "ping" });
    return NextResponse.json({ ok: true, sheet: JSON.parse(body) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = /<html|<!DOCTYPE/i.test(msg)
      ? "Apps Script ตอบเป็นหน้าเว็บ แปลว่า Deploy ไม่ได้ตั้ง Who has access: Anyone หรือ URL ผิด"
      : /unauthorized/.test(msg)
        ? "SECRET ใน Code.gs ไม่ตรงกับ GOOGLE_SHEET_SECRET ใน Vercel (หรือแก้โค้ดแล้วยังไม่ได้ Deploy เวอร์ชันใหม่)"
        : undefined;
    return NextResponse.json({ ok: false, error: msg.slice(0, 300), hint });
  }
}
