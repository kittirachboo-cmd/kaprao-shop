import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-display text-4xl text-basil">ไม่เจอหน้านี้</h1>
      <p className="text-muted mt-2">ลิงก์อาจพิมพ์ผิด หรือเมนูนี้ปิดขายไปแล้ว</p>
      <Link href="/menu" className="inline-block mt-6 rounded-lg bg-yolk text-ink font-semibold px-5 py-3">
        กลับไปดูเมนู
      </Link>
    </div>
  );
}
