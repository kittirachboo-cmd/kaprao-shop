"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { unitPrice, useCart, type CartLine } from "@/components/cart";
import { Stepper } from "@/components/add-to-cart";
import { AddressFields } from "@/components/address-fields";
import { optionsText } from "@/lib/shop";

function LineImage({ l }: { l: CartLine }) {
  const box = "w-28 h-28 sm:w-32 sm:h-32 rounded-lg";
  if (l.image) {
    // eslint-disable-next-line @next/next/no-img-element -- รูปเมนูจาก Unsplash/Storage (ย่อผ่าน URL แล้ว)
    return <img src={l.image} alt="" loading="lazy" className={`${box} object-cover bg-basil-soft`} />;
  }
  return (
    <div
      aria-hidden="true"
      className={`${box} bg-basil text-yolk font-display grid place-items-center text-center text-lg leading-tight p-2`}
    >
      {l.name.replace("กะเพรา", "")}
    </div>
  );
}

export default function CartPage() {
  const cart = useCart();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!cart.ready) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-muted">กำลังโหลดตะกร้า…</div>;
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-basil">ตะกร้ายังว่าง</h1>
        <p className="text-muted mt-2">เลือกกะเพราสักจาน แล้วกลับมาที่นี่</p>
        <Link
          href="/menu"
          className="inline-block mt-6 rounded-lg bg-yolk text-ink font-semibold px-5 py-3"
        >
          ดูเมนู
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    if (!f.get("addr_zip")) {
      setError("เลือกแขวง/เขตให้เรียบร้อยก่อน (ใส่รหัสไปรษณีย์ หรือกดเลือกเขตเอง)");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: f.get("name"),
            phone: f.get("phone"),
            address: f.get("address"),
            khet: f.get("addr_khet"),
            khwaeng: f.get("addr_khwaeng"),
            zip: f.get("addr_zip"),
            note: f.get("note"),
          },
          items: cart.lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            options: l.options,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สั่งไม่สำเร็จ");
      cart.clear();
      router.push(`/order/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สั่งไม่สำเร็จ ลองใหม่อีกครั้ง");
      setSending(false);
    }
  }

  const input =
    "w-full rounded-lg border border-line bg-white px-3 py-2.5 focus:border-basil focus:outline-none";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-4xl text-basil">ตะกร้า</h1>

      <ul className="mt-4 divide-y divide-line">
        {cart.lines.map((l) => (
          <li key={l.key} className="py-4 flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              <Link href={`/menu/${l.slug}`} className="font-semibold text-lg leading-snug">
                {l.name}
              </Link>
              <p className="text-sm text-muted">{optionsText(l.options)}</p>
              <p className="mt-1 text-sm text-muted tabular-nums">
                {unitPrice(l)} บาท × {l.qty}
              </p>
              <p className="mt-1 font-semibold tabular-nums">{unitPrice(l) * l.qty} บาท</p>
              <button
                type="button"
                className="mt-2 text-sm text-chili underline underline-offset-4"
                onClick={() => cart.remove(l.key)}
              >
                ลบ
              </button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <LineImage l={l} />
              <Stepper value={l.qty} max={20} min={0} onChange={(n) => cart.setQty(l.key, n)} />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex justify-between items-baseline border-t-2 border-basil pt-3">
        <span className="font-semibold">รวม {cart.count} จาน</span>
        <span className="text-2xl font-semibold tabular-nums">{cart.total} บาท</span>
      </div>

      <form onSubmit={submit} className="mt-10 space-y-4">
        <h2 className="font-display text-2xl text-basil">ส่งไปที่ไหน</h2>
        <label className="block">
          <span className="text-sm font-semibold">ชื่อผู้รับ</span>
          <input name="name" required maxLength={80} autoComplete="name" className={input} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">เบอร์โทร</span>
          <input
            name="phone"
            required
            inputMode="tel"
            pattern="0[0-9\-\s]{8,11}"
            autoComplete="tel"
            placeholder="08x-xxx-xxxx"
            className={input}
          />
        </label>
        <AddressFields />
        <label className="block">
          <span className="text-sm font-semibold">หมายเหตุถึงร้าน (ไม่บังคับ)</span>
          <input name="note" maxLength={200} placeholder="เช่น ไม่ใส่ถั่วฝักยาว" className={input} />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-chili text-chili px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-lg bg-chili text-white font-semibold py-3 text-lg disabled:opacity-60"
        >
          {sending ? "กำลังส่งออเดอร์…" : `สั่งเลย · ${cart.total} บาท`}
        </button>
        <p className="text-sm text-muted text-center">
          กดแล้วจะได้ QR พร้อมเพย์สำหรับจ่ายเงิน แล้วแนบสลิปในหน้าถัดไป
        </p>
      </form>
    </div>
  );
}
