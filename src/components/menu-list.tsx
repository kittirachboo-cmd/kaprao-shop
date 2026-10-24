import Link from "next/link";
import type { Product } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/shop";

export function stockOf(p: Product) {
  return p.supply?.remaining ?? 0;
}

export function Thumb({ p, size = "md" }: { p: Product; size?: "md" | "lg" }) {
  const box = size === "lg" ? "w-full aspect-[4/3] text-5xl" : "w-16 h-16 text-base";
  if (p.image_url) {
    // eslint-disable-next-line @next/next/no-img-element -- รูปจาก Unsplash (ย่อขนาดผ่าน URL แล้ว)
    return (
      <img
        src={p.image_url}
        alt={size === "lg" ? p.name : ""}
        loading={size === "lg" ? "eager" : "lazy"}
        className={`${box} shrink-0 object-cover rounded-lg bg-basil-soft`}
      />
    );
  }
  const word = p.name.replace("กะเพรา", "");
  return (
    <div
      aria-hidden="true"
      className={`${box} shrink-0 rounded-lg bg-basil text-yolk font-display grid place-items-center text-center leading-tight p-1 overflow-hidden`}
    >
      {word}
    </div>
  );
}

function StockNote({ left }: { left: number }) {
  if (left <= 0) return <span className="text-chili font-semibold">หมดแล้ววันนี้</span>;
  if (left <= 5) return <span className="text-chili">เหลือ {left} จาน</span>;
  return null;
}

export function MenuRow({ p }: { p: Product }) {
  const left = stockOf(p);
  const soldOut = left <= 0;
  return (
    <li>
      <Link
        href={`/menu/${p.slug}`}
        className={`flex gap-3 py-3 rounded-lg -mx-2 px-2 hover:bg-basil-soft ${soldOut ? "opacity-55" : ""}`}
      >
        <Thumb p={p} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-[1.05rem]">{p.name}</span>
            <span className="leader" />
            <span className="font-semibold tabular-nums">{p.price}.-</span>
          </div>
          <p className="text-sm text-muted line-clamp-2">{p.description}</p>
          <p className="text-sm">
            <StockNote left={left} />
          </p>
        </div>
      </Link>
    </li>
  );
}

export function MenuBoard({ products }: { products: Product[] }) {
  return (
    <div className="space-y-10">
      {CATEGORIES.map((c) => {
        const items = products.filter((p) => p.category === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id} id={c.id} className="scroll-mt-28">
            <h2 className="font-display text-2xl text-basil border-b-2 border-basil pb-1 mb-2">
              {c.label}
            </h2>
            <ul>
              {items.map((p) => (
                <MenuRow key={p.id} p={p} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function CategoryNav() {
  return (
    <nav
      aria-label="หมวดหมู่"
      className="sticky top-14 z-20 bg-rice/95 backdrop-blur border-b border-line -mx-4 px-4"
    >
      <ul className="flex gap-2 overflow-x-auto py-2 text-sm">
        {CATEGORIES.map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              className="block whitespace-nowrap rounded-full border border-basil text-basil px-3 py-1 hover:bg-basil hover:text-rice"
            >
              {c.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MenuError() {
  return (
    <div className="rounded-lg border border-chili p-4 text-sm">
      <p className="font-semibold text-chili">โหลดเมนูไม่ได้</p>
      <p className="text-muted">
        เชื่อมต่อฐานข้อมูลไม่สำเร็จ เช็กค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY
        แล้วรันไฟล์ supabase/schema.sql หรือยัง
      </p>
    </div>
  );
}

export function MenuSkeleton() {
  return (
    <ul className="space-y-4" aria-busy="true" aria-label="กำลังโหลดเมนู">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex gap-3">
          <div className="w-16 h-16 rounded-lg bg-basil-soft" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-2/3 rounded bg-basil-soft" />
            <div className="h-3 w-full rounded bg-basil-soft" />
          </div>
        </li>
      ))}
    </ul>
  );
}
