// ค่าคงที่ของร้าน + ตัวเลือกเสริม (ใช้ทั้งฝั่งหน้าเว็บและฝั่ง server)

export const SHOP = {
  name: "กะเพราไฟลุก",
  tagline: "ผัดจานต่อจาน ไฟแรงทุกจาน",
  hours: "เปิดทุกวัน 10:00–21:00",
};

export type Category = "pork" | "poultry" | "beef" | "seafood" | "other";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "pork", label: "หมู" },
  { id: "poultry", label: "ไก่ & เป็ด" },
  { id: "beef", label: "เนื้อวัว" },
  { id: "seafood", label: "ทะเล" },
  { id: "other", label: "อื่น ๆ" },
];

export const categoryLabel = (c: string) =>
  CATEGORIES.find((x) => x.id === c)?.label ?? c;

// ไข่ — ราคาเพิ่ม (บาท)
export const EGG_OPTIONS = [
  { id: "none", label: "ไม่ใส่ไข่", price: 0 },
  { id: "fried", label: "ไข่ดาว", price: 10 },
  { id: "fried-runny", label: "ไข่ดาวไม่สุก", price: 10 },
  { id: "omelet", label: "ไข่เจียว", price: 15 },
] as const;

export const SPICE_LEVELS = [
  { id: 0, label: "ไม่เผ็ด" },
  { id: 1, label: "เผ็ดน้อย" },
  { id: 2, label: "เผ็ดกลาง" },
  { id: 3, label: "เผ็ดมาก" },
  { id: 4, label: "เผ็ดไฟลุก" },
] as const;

export const EXTRA_PORTION_PRICE = 20; // "พิเศษ" เพิ่มข้าว+เนื้อ

export type EggId = (typeof EGG_OPTIONS)[number]["id"];

export type LineOptions = {
  egg: EggId;
  spice: number; // 0-4
  extra: boolean; // พิเศษ
};

export function optionsPrice(o: LineOptions) {
  const egg = EGG_OPTIONS.find((e) => e.id === o.egg)?.price ?? 0;
  return egg + (o.extra ? EXTRA_PORTION_PRICE : 0);
}

export function optionsText(o: LineOptions) {
  const parts: string[] = [];
  if (o.extra) parts.push("พิเศษ");
  const egg = EGG_OPTIONS.find((e) => e.id === o.egg);
  if (egg && egg.id !== "none") parts.push(egg.label);
  parts.push(SPICE_LEVELS.find((s) => s.id === o.spice)?.label ?? "");
  return parts.filter(Boolean).join(", ");
}

export const baht = (n: number) =>
  new Intl.NumberFormat("th-TH").format(n) + " บาท";
