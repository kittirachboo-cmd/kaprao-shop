import type { Metadata } from "next";
import { Suspense } from "react";
import { getProductsSafe } from "@/lib/supabase";
import { CategoryNav, MenuBoard, MenuError, MenuSkeleton } from "@/components/menu-list";

export const metadata: Metadata = { title: "เมนู" };

async function Board() {
  const products = await getProductsSafe();
  if (!products) return <MenuError />;
  return <MenuBoard products={products} />;
}

export default function MenuPage() {
  return (
    <div className="mx-auto max-w-3xl px-4">
      <h1 className="font-display text-4xl text-basil pt-8 pb-2">เมนูกะเพรา</h1>
      <p className="text-muted mb-4">
        ทุกจานเสิร์ฟพร้อมข้าวสวย เลือกไข่และระดับเผ็ดได้ในหน้าเมนู
      </p>
      <CategoryNav />
      <div className="pt-6">
        <Suspense fallback={<MenuSkeleton />}>
          <Board />
        </Suspense>
      </div>
    </div>
  );
}
