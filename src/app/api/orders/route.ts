import { NextResponse } from "next/server";
import { db, type OrderItem } from "@/lib/supabase";
import { notifySheet } from "@/lib/notify";
import { isBangkokArea } from "@/lib/bangkok";
import {
  EGG_OPTIONS,
  optionsPrice,
  optionsText,
  type LineOptions,
} from "@/lib/shop";

type IncomingLine = { productId: number; qty: number; options: LineOptions };

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  let body: { customer?: Record<string, unknown>; items?: IncomingLine[] };
  try {
    body = await req.json();
  } catch {
    return bad("ข้อมูลไม่ถูกต้อง");
  }

  // ---------- ตรวจข้อมูลลูกค้า ----------
  const street = clean(body.customer?.address, 250);
  const khet = clean(body.customer?.khet, 40);
  const khwaeng = clean(body.customer?.khwaeng, 40);
  const zip = clean(body.customer?.zip, 5);
  const customer = {
    name: clean(body.customer?.name, 80),
    phone: clean(body.customer?.phone, 20).replace(/[^\d]/g, ""),
    address: `${street}\nแขวง${khwaeng} เขต${khet} กรุงเทพฯ ${zip}`,
    note: clean(body.customer?.note, 200),
  };
  if (!customer.name) return bad("กรอกชื่อผู้รับ");
  if (!/^0\d{8,9}$/.test(customer.phone)) return bad("เบอร์โทรต้องเป็นเลข 9–10 หลัก ขึ้นต้นด้วย 0");
  if (street.length < 5) return bad("กรอกบ้านเลขที่ ซอย ถนน ให้ครบ");
  if (!isBangkokArea(khet, khwaeng, zip)) return bad("ตอนนี้ร้านส่งเฉพาะในกรุงเทพฯ เลือกแขวง/เขตใหม่อีกครั้ง");

  // ---------- ตรวจรายการ ----------
  const lines = Array.isArray(body.items) ? body.items : [];
  if (lines.length === 0) return bad("ตะกร้าว่าง");
  if (lines.length > 15) return bad("สั่งได้สูงสุด 15 รายการต่อออเดอร์");

  for (const l of lines) {
    if (!Number.isInteger(l?.productId)) return bad("รายการอาหารไม่ถูกต้อง");
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 20) return bad("จำนวนต้องอยู่ระหว่าง 1–20 จาน");
    const o = l.options ?? ({} as LineOptions);
    if (!EGG_OPTIONS.some((e) => e.id === o.egg)) return bad("ตัวเลือกไข่ไม่ถูกต้อง");
    if (!Number.isInteger(o.spice) || o.spice < 0 || o.spice > 4) return bad("ระดับความเผ็ดไม่ถูกต้อง");
    if (typeof o.extra !== "boolean") return bad("ตัวเลือกพิเศษไม่ถูกต้อง");
  }

  // ---------- คิดราคาจากฐานข้อมูล (ไม่เชื่อราคาจาก browser) ----------
  const ids = [...new Set(lines.map((l) => l.productId))];
  const { data: products, error } = await db()
    .from("products")
    .select("id, name, price, supply_id, is_active")
    .in("id", ids);
  if (error) return bad("ระบบฐานข้อมูลขัดข้อง ลองใหม่อีกครั้ง", 500);

  const items: OrderItem[] = [];
  for (const l of lines) {
    const p = products?.find((x) => x.id === l.productId);
    if (!p || !p.is_active) return bad("มีเมนูที่ปิดขายไปแล้ว ลบออกจากตะกร้าแล้วสั่งใหม่");
    const unit = p.price + optionsPrice(l.options);
    items.push({
      product_id: p.id,
      supply_id: p.supply_id,
      name: p.name,
      qty: l.qty,
      unit_price: unit,
      options: optionsText(l.options),
      line_total: unit * l.qty,
    });
  }
  const total = items.reduce((s, i) => s + i.line_total, 0);

  // ---------- ตัดสต็อก + บันทึกออเดอร์ (atomic) ----------
  const { data: placed, error: rpcError } = await db().rpc("place_order", {
    p_customer: customer,
    p_items: items,
    p_total: total,
  });
  if (rpcError) {
    const m = rpcError.message.match(/OUT_OF_STOCK:(.+)/);
    if (m) return bad(`${m[1].trim()} หมดแล้ว ลดจำนวนหรือเปลี่ยนเมนูนะ`, 409);
    console.error(rpcError);
    return bad("บันทึกออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้ง", 500);
  }

  // ---------- เขียนลง Google Sheet (ล้มก็ไม่กระทบออเดอร์) ----------
  const order = {
    id: placed.id as string,
    order_no: placed.order_no as number,
    created_at: placed.created_at as string,
    customer_name: customer.name,
    phone: customer.phone,
    address: customer.address,
    note: customer.note,
    items,
    total,
    status: "รอชำระเงิน",
  };
  try {
    await notifySheet("order", order);
  } catch (e) {
    console.error("sheet:", e);
  }

  return NextResponse.json({ id: order.id, order_no: order.order_no });
}
