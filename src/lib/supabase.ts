import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { connection } from "next/server";

// ใช้ได้เฉพาะฝั่ง server (Server Component / Route Handler)
// ใช้ service role key → อย่าเอาไปใช้ใน Client Component เด็ดขาด
let client: SupabaseClient | null = null;

export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY (ดู .env.example)",
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number;
  supply_id: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  supply: { remaining: number } | null;
};

export type OrderItem = {
  product_id: number;
  supply_id: number;
  name: string;
  qty: number;
  unit_price: number;
  options: string;
  line_total: number;
};

export type Order = {
  id: string;
  order_no: number;
  customer_name: string;
  phone: string;
  address: string;
  note: string;
  items: OrderItem[];
  total: number;
  status: string;
  created_at: string;
  slip_path: string | null;
  slip_result: string | null;
  slip_at: string | null;
  paid_at: string | null;
};

const PRODUCT_COLS =
  "id, slug, name, description, category, price, supply_id, image_url, is_active, sort_order, supply(remaining)";

export async function getProducts(): Promise<Product[]> {
  await connection(); // ดึงสดทุกครั้ง (สต็อกเปลี่ยนตลอด) ไม่ให้ build ค้างค่าไว้
  const { data, error } = await db()
    .from("products")
    .select(PRODUCT_COLS)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data as unknown as Product[];
}

/** คืน null ถ้าต่อฐานข้อมูลไม่ได้ (ให้หน้าเว็บแสดงข้อความแทนการพังทั้งหน้า) */
export async function getProductsSafe(): Promise<Product[] | null> {
  try {
    return await getProducts();
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getProduct(slug: string): Promise<Product | null> {
  await connection();
  const { data, error } = await db()
    .from("products")
    .select(PRODUCT_COLS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Product | null;
}

export async function getOrder(id: string): Promise<Order | null> {
  await connection();
  // กัน id มั่ว ๆ ที่ไม่ใช่ uuid
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Order | null;
}
