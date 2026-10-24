import "server-only";

/**
 * ตรวจสลิปโอนเงิน
 *
 * - ถ้าตั้ง EASYSLIP_API_KEY (สมัครฟรีที่ developer.easyslip.com) → อ่าน QR บนสลิปแล้วถามธนาคารว่าโอนจริงไหม
 *   เช็ก: ยอดตรงไหม, โอนหลังสั่งไหม, เข้าบัญชีร้านไหม, สลิปเคยใช้ไปแล้วหรือยัง
 * - ถ้าไม่ตั้ง → ส่งให้ร้านตรวจเอง (สถานะ "รอตรวจสลิป")
 */

export type SlipVerdict =
  | { kind: "paid"; ref: string; result: string } // ผ่านครบ → ชำระแล้ว
  | { kind: "review"; ref: string | null; result: string } // ให้ร้านตรวจเอง
  | { kind: "reject"; message: string }; // บอกลูกค้าให้ส่งใหม่

type EasySlipData = {
  transRef?: string;
  date?: string;
  amount?: { amount?: number };
  sender?: { account?: { name?: { th?: string; en?: string } } };
  receiver?: {
    account?: {
      name?: { th?: string; en?: string };
      bank?: { account?: string };
      proxy?: { type?: string; account?: string };
    };
  };
};

const digits = (s?: string) => (s ?? "").replace(/[^\dx]/gi, "").toLowerCase();

/** เลขบัญชี/พร้อมเพย์ที่ธนาคารส่งมาจะถูกปิดบางหลัก (xxx-xxx-5678) → เทียบเฉพาะหลักที่เห็น */
function sameMasked(masked: string, real: string) {
  const m = digits(masked);
  if (!m || m.length !== real.length) return null; // เทียบไม่ได้
  for (let i = 0; i < m.length; i++) if (m[i] !== "x" && m[i] !== real[i]) return false;
  return true;
}

export async function verifySlip(
  file: Blob,
  order: { total: number; created_at: string },
): Promise<SlipVerdict> {
  const key = process.env.EASYSLIP_API_KEY;
  if (!key) return { kind: "review", ref: null, result: "รอร้านตรวจ (ไม่ได้เปิดตรวจอัตโนมัติ)" };

  const form = new FormData();
  form.append("file", file, "slip.jpg");

  let json: { status?: number; message?: string; data?: EasySlipData };
  try {
    const res = await fetch("https://developer.easyslip.com/api/v1/verify", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    json = await res.json();
  } catch (e) {
    console.error("easyslip:", e);
    return { kind: "review", ref: null, result: "ตรวจอัตโนมัติไม่สำเร็จ (ระบบตรวจล่ม) รอร้านตรวจ" };
  }

  if (json.status !== 200 || !json.data) {
    const msg = json.message ?? "";
    // อ่าน QR ไม่ได้ / ไม่ใช่สลิป → ให้ลูกค้าส่งใหม่
    if (/qrcode_not_found|invalid_image|image_size_too_large/i.test(msg)) {
      return {
        kind: "reject",
        message: "อ่าน QR บนสลิปไม่ได้ ลองแคปหน้าจอสลิปให้เห็น QR ชัด ๆ แล้วส่งใหม่",
      };
    }
    if (/slip_not_found|invalid_payload/i.test(msg)) {
      return { kind: "reject", message: "ธนาคารไม่พบรายการโอนนี้ เช็กว่าเป็นสลิปจริงแล้วส่งใหม่" };
    }
    // โควตาหมด / key ผิด / ระบบล่ม → ไม่ใช่ความผิดลูกค้า ให้ร้านตรวจเอง
    console.error("easyslip:", json.status, msg);
    return { kind: "review", ref: null, result: `ตรวจอัตโนมัติไม่สำเร็จ (${msg || json.status}) รอร้านตรวจ` };
  }

  const d = json.data;
  const ref = d.transRef ?? null;
  const amount = Number(d.amount?.amount ?? NaN);
  const sender = d.sender?.account?.name?.th || d.sender?.account?.name?.en || "-";
  const problems: string[] = [];

  if (amount !== order.total) problems.push(`ยอดโอน ${amount} ไม่ตรงกับยอดสั่ง ${order.total}`);

  if (d.date && new Date(d.date).getTime() < new Date(order.created_at).getTime() - 10 * 60_000) {
    problems.push("โอนก่อนสั่งออเดอร์ (อาจเป็นสลิปเก่า)");
  }

  const pp = (process.env.PROMPTPAY_ID ?? "").replace(/\D/g, "");
  const acc = d.receiver?.account;
  const shopAcc = (process.env.SHOP_BANK_ACCOUNT ?? "").replace(/\D/g, "");
  const checks = [
    acc?.proxy?.account && pp ? sameMasked(acc.proxy.account, pp) : null,
    acc?.bank?.account && shopAcc ? sameMasked(acc.bank.account, shopAcc) : null,
  ].filter((x) => x !== null);
  if (checks.length > 0 && !checks.includes(true)) {
    problems.push(`ผู้รับเงินไม่ใช่บัญชีร้าน (${acc?.name?.th ?? acc?.proxy?.account ?? acc?.bank?.account ?? "-"})`);
  }

  const summary = `ยอด ${amount} บาท จาก ${sender} · ref ${ref ?? "-"}`;
  if (problems.length === 0) return { kind: "paid", ref: ref ?? "", result: `ผ่านอัตโนมัติ: ${summary}` };
  return { kind: "review", ref, result: `ต้องตรวจ: ${problems.join(", ")} · ${summary}` };
}
