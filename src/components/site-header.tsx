"use client";

import Link from "next/link";
import { useCart } from "./cart";
import { SHOP } from "@/lib/shop";

export function SiteHeader() {
  const { count, ready } = useCart();
  return (
    <header className="sticky top-0 z-30 bg-basil text-rice shadow-[0_1px_0_var(--basil-deep)]">
      <div className="mx-auto max-w-3xl px-4 h-14 flex items-center gap-4">
        <Link href="/" className="font-display text-xl tracking-wide flex items-center gap-2">
          <Flame className="w-5 h-6" />
          {SHOP.name}
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/menu" className="px-3 py-2 rounded-md hover:bg-basil-deep">
            เมนู
          </Link>
          <Link
            href="/cart"
            className="px-3 py-2 rounded-md bg-rice text-basil font-semibold flex items-center gap-2"
          >
            ตะกร้า
            {ready && count > 0 && (
              <span
                aria-label={`${count} จาน`}
                className="min-w-6 h-6 px-1.5 grid place-items-center rounded-full bg-chili text-white text-xs"
              >
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Flame({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 24" className={className} aria-hidden="true">
      <path
        className="flame"
        d="M10 1c1 4 6 6.5 6 12.5A6 6 0 0 1 4 13.5c0-2.6 1.4-4.2 2.7-5.6.2 1.8 1 3 2.3 3.6C8.7 7.6 9.3 4 10 1z"
        fill="var(--yolk)"
      />
      <path d="M10 12c.6 2 3 3 3 5.3a3 3 0 0 1-6 0c0-1.3.8-2.1 1.5-2.8.3 1 .8 1.4 1.5 1.6-.4-1.6-.3-2.7 0-4.1z" fill="var(--chili)" />
    </svg>
  );
}
