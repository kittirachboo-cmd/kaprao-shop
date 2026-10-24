import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db, getOrder } from "@/lib/supabase";
import { verifySlip } from "@/lib/slip";
import { notifySheet } from "@/lib/notify";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel รับ body ได้ ~4.5MB (หน้าเว็บย่อรูปให้ก่อนแล้ว)
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // ลิงก์ดูสลิปในชีตใช้ได้ 1 ปี

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/orders/[id]/slip">) {
  const { id } = await ctx.params;
  const order = await getOrder(id);
  if (!order) return bad("ไม่พบออเดอร์", 404);
  if (order.status !== "รอชำระเงิน" && order.status !== "รอตรวจสลิป") {
    return bad(`ออเดอร์นี้สถานะ "${order.status}" แล้ว ไม่ต้องแนบสลิปเพิ่ม`, 409);
  }

  let file: File | null = null;
  try {
    const f = (await req.formData()).get("slip");
    file = f instanceof File ? f : null;
  } catch {
    return bad("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
  if (!file || file.size === 0) return bad("เลือกรูปสลิปก่อน");
  if (file.size > MAX_BYTES) return bad("รูปใหญ่เกินไป (เกิน 4MB)");
  const ext = TYPES[file.type];
  if (!ext) return bad("รองรับเฉพาะรูป JPG / PNG / WEBP");

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex");

  // ---------- ตรวจสลิป ----------
  const verdict = await verifySlip(new Blob([buf], { type: file.type }), order);
  if (verdict.kind === "reject") return bad(verdict.message, 422);

  // ---------- เก็บรูปใน Storage ----------
  const path = `${order.id}/${Date.now()}.${ext}`;
  const up = await db().storage.from("slips").upload(path, buf, { contentType: file.type });
  if (up.error) {
    console.error("slip upload:", up.error);
    return bad("บันทึกรูปสลิปไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }

  const status = verdict.kind === "paid" ? "ชำระแล้ว" : "รอตรวจสลิป";
  const now = new Date().toISOString();
  const { error } = await db()
    .from("orders")
    .update({
      status,
      slip_path: path,
      slip_hash: hash,
      slip_ref: verdict.ref || null,
      slip_result: verdict.result,
      slip_at: now,
      paid_at: status === "ชำระแล้ว" ? now : null,
    })
    .eq("id", order.id)
    .in("status", ["รอชำระเงิน", "รอตรวจสลิป"]);

  if (error) {
    await db().storage.from("slips").remove([path]);
    if (error.code === "23505") return bad("สลิปนี้เคยถูกใช้กับออเดอร์อื่นแล้ว", 409);
    console.error("slip update:", error);
    return bad("บันทึกสลิปไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }

  // ---------- แจ้งร้านผ่าน Google Sheet (ล้มก็ไม่กระทบ) ----------
  try {
    const signed = await db().storage.from("slips").createSignedUrl(path, SIGNED_URL_TTL);
    await notifySheet(
      "slip",
      { ...order, status },
      { url: signed.data?.signedUrl ?? "", result: verdict.result },
    );
  } catch (e) {
    console.error("sheet slip:", e);
  }

  return NextResponse.json({ status, result: verdict.result });
}
