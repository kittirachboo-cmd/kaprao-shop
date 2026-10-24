import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getProduct } from "@/lib/supabase";
import { Thumb, stockOf } from "@/components/menu-list";
import { AddToCart } from "@/components/add-to-cart";
import { categoryLabel } from "@/lib/shop";

async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();
  const left = stockOf(p);

  return (
    <article className="grid sm:grid-cols-2 gap-6 sm:gap-10">
      <Thumb p={p} size="lg" />
      <div>
        <p className="text-sm text-muted">
          <Link href={`/menu#${p.category}`} className="underline underline-offset-4">
            {categoryLabel(p.category)}
          </Link>
        </p>
        <h1 className="font-display text-4xl text-basil leading-tight mt-1">{p.name}</h1>
        <p className="mt-2 text-muted">{p.description}</p>
        <p className="mt-3 text-2xl font-semibold">
          {p.price} บาท
          <span className="ml-3 text-sm font-normal text-muted">
            {left > 0 ? `วันนี้เหลือ ${left} จาน` : ""}
          </span>
        </p>
        <div className="mt-6">
          <AddToCart
            product={{ id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image_url }}
            stock={left}
          />
        </div>
      </div>
    </article>
  );
}

export default function ProductPage({ params }: PageProps<"/menu/[slug]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/menu" className="text-sm text-basil underline underline-offset-4">
        กลับไปหน้าเมนู
      </Link>
      <div className="mt-4">
        <Suspense
          fallback={<div className="aspect-[4/3] sm:w-1/2 rounded-lg bg-basil-soft" />}
        >
          <Detail params={params} />
        </Suspense>
      </div>
    </div>
  );
}
