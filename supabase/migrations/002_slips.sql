-- =====================================================================
-- อัปเดตฐานข้อมูลเดิม: เพิ่มระบบแนบสลิป
-- ใช้กับโปรเจกต์ที่รัน schema.sql ไปแล้ว (ไม่ลบข้อมูลเดิม ไม่รีเซ็ตเมนู)
-- วิธีใช้: Supabase → SQL Editor → วางไฟล์นี้ → Run (รันซ้ำได้)
-- =====================================================================

alter table public.orders
  add column if not exists slip_path   text,
  add column if not exists slip_hash   text,
  add column if not exists slip_ref    text,
  add column if not exists slip_result text,
  add column if not exists slip_at     timestamptz,
  add column if not exists paid_at     timestamptz;

create unique index if not exists orders_slip_hash_key on public.orders (slip_hash);
create unique index if not exists orders_slip_ref_key  on public.orders (slip_ref);

-- เพิ่มสถานะ "รอตรวจสลิป"
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('รอชำระเงิน','รอตรวจสลิป','ชำระแล้ว','กำลังทำ','จัดส่งแล้ว','ยกเลิก'));

-- bucket เก็บรูปสลิป (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slips', 'slips', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
