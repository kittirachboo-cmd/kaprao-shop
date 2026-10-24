import "server-only";
import type { Order } from "./supabase";

type SheetOrder = Pick<
  Order,
  "id" | "order_no" | "created_at" | "customer_name" | "phone" | "address" | "note" | "items" | "total" | "status"
>;

export type SlipInfo = {
  url: string; // ลิงก์ดูรูปสลิป (signed URL)
  result: string; // ผลตรวจสลิป อ่านง่าย ๆ
};

const thaiTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "short",
    timeStyle: "short",
  });

/** ยิงไป Apps Script แล้วคืนข้อความตอบกลับ (โยน error ถ้าไม่ ok) */
export async function postSheet(payload: Record<string, unknown>) {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SHEET_WEBHOOK_URL");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret: process.env.GOOGLE_SHEET_SECRET ?? "", ...payload }),
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Sheet HTTP ${res.status}: ${body.slice(0, 200)}`);
  if (!body.includes('"ok":true')) throw new Error(`Sheet: ${body.slice(0, 300)}`);
  return body;
}

/**
 * เขียน/อัปเดตแถวออเดอร์ใน Google Sheet (Apps Script หาแถวจาก Order ID ถ้าไม่เจอจะเพิ่มแถวใหม่)
 * action "order" = ออเดอร์ใหม่, "slip" = ลูกค้าแนบสลิป
 */
export async function notifySheet(action: "order" | "slip", o: SheetOrder, slip?: SlipInfo) {
  if (!process.env.GOOGLE_SHEET_WEBHOOK_URL) return "skipped";
  await postSheet({
    action,
    order_id: o.id,
    order_no: o.order_no,
    created_at: thaiTime(o.created_at),
    customer_name: o.customer_name,
    phone: o.phone,
    address: o.address,
    items: o.items
      .map((i) => `${i.name} x${i.qty}${i.options ? ` (${i.options})` : ""}`)
      .join("\n"),
    dishes: o.items.reduce((n, i) => n + i.qty, 0),
    total: o.total,
    note: o.note,
    status: o.status,
    slip_url: slip?.url ?? "",
    slip_result: slip?.result ?? "",
  });
  return "sent";
}
