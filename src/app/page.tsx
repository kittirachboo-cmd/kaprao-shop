import Link from "next/link";
import { Suspense } from "react";
import { getProductsSafe } from "@/lib/supabase";
import { MenuError, MenuRow, MenuSkeleton, stockOf } from "@/components/menu-list";
import { Flame } from "@/components/site-header";
import { SHOP } from "@/lib/shop";

const POPULAR = ["pork-minced", "pork-crispy", "beef-minced", "seafood-mix"];

async function Wagyu() {
  const products = await getProductsSafe();
  const w = products?.find((p) => p.slug === "wagyu-a5");
  if (!w) return null;
    const left = stockOf(w);
    return (
      <Link
        href={`/menu/${w.slug}`}
        className="mt-8 flex items-center gap-4 rounded-xl bg-basil-deep/60 p-4 hover:bg-basil-deep"
      >
        <span className="font-display text-4xl text-yolk tabular-nums w-14 text-center">
          {left}
        </span>
        <span className="text-sm leading-snug">
          <b className="block text-base text-rice">
            {left > 0 ? "จานวากิว A5 ที่เหลือวันนี้" : "วากิว A5 หมดแล้ววันนี้"}
          </b>
          <span className="text-rice/75">ย่างแยก วางบนกะเพรา {w.price} บาท</span>
        </span>
      </Link>
    );
}

async function Popular() {
  const products = await getProductsSafe();
  if (!products) return <MenuError />;
  const items = POPULAR.map((s) => products.find((p) => p.slug === s)).filter(
      (p): p is NonNullable<typeof p> => !!p,
    );
    return (
      <ul>
        {items.map((p) => (
          <MenuRow key={p.id} p={p} />
        ))}
      </ul>
    );
}

export default function Home() {
  return (
    <>
      <section className="bg-basil text-rice">
        <div className="mx-auto max-w-3xl px-4 pt-10 pb-12">
          <Flame className="w-12 h-14 mb-4" />
          <h1 className="font-display text-5xl sm:text-7xl leading-[1.15]">{SHOP.name}</h1>
          <p className="mt-3 text-lg text-rice/85 max-w-md">
            {SHOP.tagline} หมู ไก่ เนื้อ ทะเล 15 แบบ สั่งก่อน จ่ายพร้อมเพย์ รอรับที่บ้าน
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/menu"
              className="rounded-lg bg-yolk text-ink font-semibold px-5 py-3 hover:brightness-95"
            >
              ดูเมนูทั้งหมด
            </Link>
          </div>
          <Suspense fallback={null}>
            <Wagyu />
          </Suspense>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4">
        <section className="py-10">
          <h2 className="font-display text-2xl text-basil mb-4">สั่งยังไง</h2>
          <ol className="grid sm:grid-cols-3 gap-4">
            {[
              ["เลือกเมนู", "เลือกเนื้อ ไข่ ระดับเผ็ด แล้วใส่ตะกร้า"],
              ["กรอกที่อยู่", "ชื่อ เบอร์โทร ที่อยู่ส่ง"],
              ["สแกนจ่าย", "สแกน QR พร้อมเพย์ ยอดขึ้นให้อัตโนมัติ"],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="font-display text-3xl text-chili leading-none">{i + 1}</span>
                <span>
                  <b className="block">{t}</b>
                  <span className="text-sm text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <div className="flex items-baseline justify-between border-b-2 border-basil pb-1 mb-2">
            <h2 className="font-display text-2xl text-basil">ขายดี</h2>
            <Link href="/menu" className="text-sm text-basil underline underline-offset-4">
              ดูทั้ง 15 เมนู
            </Link>
          </div>
          <Suspense fallback={<MenuSkeleton />}>
            <Popular />
          </Suspense>
        </section>
      </div>
    </>
  );
}
