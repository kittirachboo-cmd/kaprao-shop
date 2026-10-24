"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart";
import {
  EGG_OPTIONS,
  EXTRA_PORTION_PRICE,
  SPICE_LEVELS,
  optionsPrice,
  type EggId,
} from "@/lib/shop";

type Props = {
  product: { id: number; slug: string; name: string; price: number; image: string | null };
  stock: number;
};

export function AddToCart({ product, stock }: Props) {
  const { add } = useCart();
  const [egg, setEgg] = useState<EggId>("fried");
  const [spice, setSpice] = useState(2);
  const [extra, setExtra] = useState(false);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const options = { egg, spice, extra };
  const unit = product.price + optionsPrice(options);
  const maxQty = Math.min(20, stock);

  if (stock <= 0) {
    return (
      <p className="rounded-lg border border-chili text-chili p-4 font-semibold">
        เมนูนี้หมดแล้ววันนี้ ลองเลือกเมนูอื่นก่อนนะ
      </p>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        add({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image: product.image,
          basePrice: product.price,
          qty,
          options,
        });
        setAdded(true);
        setQty(1);
      }}
    >
      <fieldset>
        <legend className="font-semibold mb-2">ไข่</legend>
        <div className="grid grid-cols-2 gap-2">
          {EGG_OPTIONS.map((o) => (
            <label
              key={o.id}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-sm flex justify-between has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-yolk ${
                egg === o.id ? "border-basil bg-basil text-rice" : "border-line bg-white"
              }`}
            >
              <input
                type="radio"
                name="egg"
                className="sr-only"
                checked={egg === o.id}
                onChange={() => setEgg(o.id)}
              />
              {o.label}
              <span className="opacity-80">{o.price ? `+${o.price}` : ""}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold mb-2">
          ความเผ็ด: <span className="text-chili">{SPICE_LEVELS[spice].label}</span>
        </legend>
        <div className="flex gap-1" role="radiogroup">
          {SPICE_LEVELS.map((s) => (
            <label key={s.id} className="cursor-pointer p-1 rounded-md has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-yolk">
              <input
                type="radio"
                name="spice"
                className="sr-only"
                checked={spice === s.id}
                onChange={() => setSpice(s.id)}
                aria-label={s.label}
              />
              <Chili lit={s.id > 0 && s.id <= spice} zero={s.id === 0} active={spice === s.id} />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={extra}
          onChange={(e) => setExtra(e.target.checked)}
          className="w-5 h-5 accent-[var(--basil)]"
        />
        <span>
          พิเศษ (เพิ่มเนื้อและข้าว) <span className="text-muted">+{EXTRA_PORTION_PRICE}</span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <span className="font-semibold">จำนวน</span>
        <Stepper value={qty} max={maxQty} onChange={setQty} />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-chili text-white font-semibold py-3 text-lg hover:brightness-95"
      >
        ใส่ตะกร้า · {unit * qty} บาท
      </button>

      {added && (
        <p role="status" className="rounded-lg bg-basil-soft px-4 py-3 text-sm flex justify-between items-center">
          ใส่ตะกร้าแล้ว
          <Link href="/cart" className="font-semibold text-basil underline underline-offset-4">
            ไปที่ตะกร้า
          </Link>
        </p>
      )}
    </form>
  );
}

export function Stepper({
  value,
  max,
  onChange,
  min = 1,
}: {
  value: number;
  max: number;
  min?: number;
  onChange: (n: number) => void;
}) {
  const btn =
    "w-9 h-9 rounded-md border border-line bg-white text-lg leading-none disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btn} aria-label="ลดจำนวน" disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="w-6 text-center tabular-nums font-semibold" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} aria-label="เพิ่มจำนวน" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function Chili({ lit, zero, active }: { lit: boolean; zero: boolean; active: boolean }) {
  if (zero) {
    return (
      <span
        className={`grid place-items-center w-9 h-9 rounded-full border-2 text-xs font-semibold ${
          active ? "border-basil bg-basil text-rice" : "border-line text-muted"
        }`}
      >
        0
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 36" className="w-6 h-9" aria-hidden="true">
      <path d="M12 2c-1 2-1 4 0 6" stroke="var(--basil)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path
        d="M12 7c4 0 6 3 5.5 8-.6 7-4 13-5.5 19-1.5-6-4.9-12-5.5-19C6 10 8 7 12 7z"
        fill={lit ? "var(--chili)" : "var(--line)"}
      />
    </svg>
  );
}
