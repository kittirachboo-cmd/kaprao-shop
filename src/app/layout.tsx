import type { Metadata, Viewport } from "next";
// ฟอนต์แบบ self-host (ไม่ต้องดึงจาก Google ตอน build)
import "@fontsource/chonburi/thai-400.css";
import "@fontsource/chonburi/latin-400.css";
import "@fontsource/ibm-plex-sans-thai/thai-400.css";
import "@fontsource/ibm-plex-sans-thai/thai-600.css";
import "@fontsource/ibm-plex-sans-thai/latin-400.css";
import "@fontsource/ibm-plex-sans-thai/latin-600.css";
import { CartProvider } from "@/components/cart";
import { SiteHeader } from "@/components/site-header";
import { SHOP } from "@/lib/shop";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${SHOP.name} — สั่งกะเพราออนไลน์`, template: `%s | ${SHOP.name}` },
  description: `${SHOP.tagline} สั่งกะเพราหมู ไก่ เนื้อ ทะเล จ่ายด้วยพร้อมเพย์`,
};

export const viewport: Viewport = { themeColor: "#1f4d2b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="antialiased">
      <body className="min-h-dvh flex flex-col">
        <CartProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line mt-16">
            <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted">
              <p className="font-display text-basil text-lg">{SHOP.name}</p>
              <p>{SHOP.hours} · ชำระเงินด้วยพร้อมเพย์</p>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
