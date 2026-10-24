"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** ย่อรูปให้ไม่เกิน ~1600px (QR บนสลิปยังอ่านได้) และไม่ชน limit อัปโหลดของ Vercel */
async function shrink(file: File): Promise<Blob> {
  if (file.size < 1.5 * 1024 * 1024 && file.type !== "image/heic") return file;
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, fail) =>
      canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/jpeg", 0.9),
    );
  } catch {
    return file; // ย่อไม่ได้ก็ส่งไฟล์เดิม ให้ server ตัดสิน
  }
}

export function SlipUpload({ orderId, again }: { orderId: string; again?: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- สร้าง/คืน object URL ตามไฟล์ที่เลือก
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function send() {
    if (!file) return;
    setSending(true);
    setError("");
    try {
      const blob = await shrink(file);
      const form = new FormData();
      form.append("slip", blob, blob === file ? file.name : "slip.jpg");
      const res = await fetch(`/api/orders/${orderId}/slip`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "ส่งสลิปไม่สำเร็จ");
      setFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งสลิปไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border-2 border-dashed border-basil bg-basil-soft/40 p-4 text-left">
      <h3 className="font-semibold">{again ? "ส่งสลิปใหม่" : "โอนแล้ว? แนบสลิปตรงนี้"}</h3>
      <p className="text-sm text-muted">แคปหน้าจอสลิปจากแอปธนาคาร ให้เห็น QR มุมสลิปชัด ๆ</p>

      <label className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-white border border-line px-4 py-3 cursor-pointer font-semibold text-basil has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-yolk">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            setError("");
            setFile(e.target.files?.[0] ?? null);
          }}
        />
        {file ? "เปลี่ยนรูป" : "เลือกรูปสลิป"}
      </label>

      {file && preview && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- พรีวิวไฟล์ในเครื่อง */}
          <img src={preview} alt="ตัวอย่างสลิปที่เลือก" className="mt-3 mx-auto max-h-80 rounded-lg border border-line" />
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="mt-3 w-full rounded-lg bg-chili text-white font-semibold py-3 disabled:opacity-60"
          >
            {sending ? "กำลังส่งและตรวจสลิป…" : "ส่งสลิป"}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-chili bg-white text-chili px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
