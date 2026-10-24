import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import QRCode from "qrcode";
import generatePayload from "promptpay-qr";
import { getOrder } from "@/lib/supabase";
import { SlipUpload } from "@/components/slip-upload";

async function OrderView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const promptpayId = process.env.PROMPTPAY_ID;
  const qr =
    promptpayId && order.status === "รอชำระเงิน"
      ? await QRCode.toDataURL(generatePayload(promptpayId, { amount: order.total }), {
          margin: 1,
          width: 480,
          color: { dark: "#003d6a", light: "#ffffff" },
        })
      : null;
  const contact = process.env.NEXT_PUBLIC_CONTACT_URL;

  return (
    <>
      <p className="text-sm text-muted">ออเดอร์</p>
      <h1 className="font-display text-5xl text-basil">#{order.order_no}</h1>
      <p className="mt-1">
        สถานะ:{" "}
        <b className={order.status === "รอชำระเงิน" || order.status === "ยกเลิก" ? "text-chili" : "text-basil"}>{order.status}</b>
      </p>

      {qr && (
        <section className="mt-6 rounded-xl bg-white border border-line p-5 text-center">
          <h2 className="font-semibold">1. สแกนจ่ายด้วยแอปธนาคาร</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
          <img
            src={qr}
            alt={`QR พร้อมเพย์ ยอด ${order.total} บาท`}
            className="mx-auto my-3 w-64 h-64"
          />
          <p className="text-3xl font-semibold tabular-nums">{order.total} บาท</p>
          <p className="text-sm text-muted mt-2">
            บันทึกภาพหน้าจอนี้ไว้ แล้วเปิดแอปธนาคาร → สแกน → เลือกรูปจากอัลบั้มได้เลย
          </p>
          <h2 className="font-semibold mt-6">2. แนบสลิป</h2>
          <SlipUpload orderId={order.id} />
        </section>
      )}

      {order.status === "รอตรวจสลิป" && (
        <section className="mt-6 rounded-xl bg-white border border-yolk p-5" role="status">
          <h2 className="font-semibold">ได้รับสลิปแล้ว ร้านกำลังตรวจ</h2>
          <p className="text-sm text-muted mt-1">
            ตรวจเสร็จสถานะจะเปลี่ยนเป็น &quot;ชำระแล้ว&quot; กดรีเฟรชหน้านี้เพื่อดูสถานะล่าสุด
          </p>
          <SlipUpload orderId={order.id} again />
        </section>
      )}

      {order.paid_at && (
        <p className="mt-6 rounded-xl bg-basil-soft p-4 font-semibold text-basil" role="status">
          ชำระเงินเรียบร้อย ร้านกำลังเตรียมกะเพราของคุณ
        </p>
      )}

      {contact && order.status !== "ยกเลิก" && (
        <p className="mt-4 text-sm text-center">
          มีปัญหาเรื่องจ่ายเงิน?{" "}
          <a
            href={contact}
            target="_blank"
            rel="noopener noreferrer"
            className="text-basil font-semibold underline underline-offset-4"
          >
            ทักร้าน
          </a>
        </p>
      )}
      {!promptpayId && order.status === "รอชำระเงิน" && (
        <p className="mt-6 rounded-lg border border-chili p-4 text-sm">
          ร้านยังไม่ได้ตั้งค่าเบอร์พร้อมเพย์ (PROMPTPAY_ID)
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-2xl text-basil border-b-2 border-basil pb-1">รายการ</h2>
        <ul className="divide-y divide-line">
          {order.items.map((i, n) => (
            <li key={n} className="py-3 flex justify-between gap-3">
              <span>
                {i.name} <span className="text-muted">x{i.qty}</span>
                <span className="block text-sm text-muted">{i.options}</span>
              </span>
              <span className="tabular-nums">{i.line_total}.-</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t-2 border-basil pt-2 font-semibold">
          <span>รวม</span>
          <span className="tabular-nums">{order.total} บาท</span>
        </p>
      </section>

      <section className="mt-8 text-sm">
        <h2 className="font-semibold">ส่งถึง</h2>
        <p>
          {order.customer_name} · {order.phone}
        </p>
        <p className="text-muted whitespace-pre-line">{order.address}</p>
        {order.note && <p className="text-muted">หมายเหตุ: {order.note}</p>}
      </section>

      <p className="mt-8 text-sm text-muted">
        เก็บลิงก์หน้านี้ไว้เช็กสถานะออเดอร์ได้ตลอด ·{" "}
        <Link href="/menu" className="text-basil underline underline-offset-4">
          สั่งเพิ่ม
        </Link>
      </p>
    </>
  );
}

export default function OrderPage({ params }: PageProps<"/order/[id]">) {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Suspense fallback={<p className="text-muted">กำลังโหลดออเดอร์…</p>}>
        <OrderView params={params} />
      </Suspense>
    </div>
  );
}
