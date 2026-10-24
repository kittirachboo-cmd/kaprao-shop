"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { optionsPrice, type LineOptions } from "@/lib/shop";

export type CartLine = {
  key: string; // productId + options → รายการเดียวกันจะรวมจำนวน
  productId: number;
  slug: string;
  name: string;
  image?: string | null; // ตะกร้าเก่าที่เก็บไว้ก่อนมีช่องนี้จะไม่มีรูป
  basePrice: number;
  qty: number;
  options: LineOptions;
};

type CartCtx = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  total: number;
  add: (l: Omit<CartLine, "key">) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const STORAGE_KEY = "kaprao-cart-v1";

export const unitPrice = (l: CartLine) => l.basePrice + optionsPrice(l.options);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- โหลดตะกร้าจาก localStorage ครั้งแรก
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {}
  }, [lines, ready]);

  const value = useMemo<CartCtx>(() => {
    const keyOf = (id: number, o: LineOptions) =>
      `${id}|${o.egg}|${o.spice}|${o.extra ? 1 : 0}`;
    return {
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.qty, 0),
      total: lines.reduce((s, l) => s + unitPrice(l) * l.qty, 0),
      add: (l) =>
        setLines((prev) => {
          const key = keyOf(l.productId, l.options);
          const found = prev.find((x) => x.key === key);
          if (found)
            return prev.map((x) =>
              x.key === key ? { ...x, qty: Math.min(20, x.qty + l.qty) } : x,
            );
          return [...prev, { ...l, key }];
        }),
      setQty: (key, qty) =>
        setLines((prev) =>
          qty <= 0
            ? prev.filter((x) => x.key !== key)
            : prev.map((x) => (x.key === key ? { ...x, qty: Math.min(20, qty) } : x)),
        ),
      remove: (key) => setLines((prev) => prev.filter((x) => x.key !== key)),
      clear: () => setLines([]),
    };
  }, [lines, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart ต้องอยู่ใน <CartProvider>");
  return c;
}
