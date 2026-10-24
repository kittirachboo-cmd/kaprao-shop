# กะเพราไฟลุก — เว็บสั่งกะเพราออนไลน์

เว็บขายข้าวกะเพรา 15 เมนู (หมู ไก่/เป็ด เนื้อ ทะเล อื่น ๆ) เลือกไข่ ระดับเผ็ด พิเศษได้
จ่ายด้วย QR พร้อมเพย์ที่ใส่ยอดเงินให้อัตโนมัติ ออเดอร์เข้าแล้วเขียนลง Google Sheet อัตโนมัติ

## Tech stack

| ส่วน | ใช้อะไร |
|---|---|
| Frontend + API | Next.js 16 (App Router, TypeScript) |
| UI | Tailwind CSS v4, ฟอนต์ Chonburi + IBM Plex Sans Thai (self-host) |
| ฐานข้อมูล | Supabase (Postgres) — ตาราง `products`, `supply`, `orders` |
| จ่ายเงิน | `promptpay-qr` + `qrcode` |
| แจ้งเตือน | Google Apps Script → Google Sheet |
| Hosting | Vercel |

## โครงสร้างระบบ

```
ลูกค้า ──► Next.js (Vercel)
            ├─ หน้าเว็บ: อ่านเมนู + สต็อก จาก Supabase
            └─ POST /api/orders
                 1. ตรวจข้อมูล + คิดราคาใหม่จากฐานข้อมูล (ไม่เชื่อราคาจาก browser)
                 2. เรียก place_order() → ตัดสต็อก supply + บันทึก orders (ทรานแซกชันเดียว)
                 3. เขียนลง Google Sheet (ล้มก็ไม่กระทบออเดอร์)
                 4. ลูกค้าไปหน้า /order/[id] → เห็น QR พร้อมเพย์ตามยอด
            └─ POST /api/orders/[id]/slip   (ลูกค้าแนบสลิป)
                 1. เก็บรูปใน Supabase Storage (bucket slips, private)
                 2. ตรวจสลิป: มี EASYSLIP_API_KEY → เช็กยอด/ผู้รับ/สลิปซ้ำ อัตโนมัติ → "ชำระแล้ว"
                                ไม่มี → "รอตรวจสลิป" ให้ร้านเปิดดูเอง
                 3. อัปเดตแถวเดิมใน Google Sheet (สถานะ + ลิงก์ดูสลิป) + อีเมลแจ้งร้าน
```

ที่อยู่จัดส่ง: ส่งเฉพาะกรุงเทพฯ ลูกค้าใส่รหัสไปรษณีย์ → เลือกแขวง/เขตจากรายการ (ข้อมูลใน `src/lib/bangkok.ts`) server ตรวจซ้ำว่าเป็นแขวง/เขต/รหัสที่มีจริง

### อัปเดตจากเวอร์ชันก่อน (มีฐานข้อมูลอยู่แล้ว)
1. Supabase → SQL Editor → รัน `supabase/migrations/002_slips.sql` (ไม่ลบข้อมูลเดิม)
2. Apps Script → วาง `google-sheet/Code.gs` ใหม่ (อย่าลืมใส่ SECRET เดิม) → Run `setup` → Deploy → Manage deployments → Edit → New version
3. เปิด `/api/sheet-test?secret=<SECRET>` เช็กว่าต่อชีตได้

## หน้าเว็บ

| URL | หน้า |
|---|---|
| `/` | หน้าแรก: แบนเนอร์ร้าน, จำนวนวากิวที่เหลือวันนี้ (สด), วิธีสั่ง, เมนูขายดี |
| `/menu` | เมนูทั้งหมด แยกหมวด มีปุ่มกระโดดไปหมวด |
| `/menu/[slug]` | รายละเอียดเมนู + เลือกไข่/เผ็ด/พิเศษ/จำนวน |
| `/cart` | ตะกร้า + ฟอร์มที่อยู่ + สั่ง |
| `/order/[id]` | สรุปออเดอร์ + QR พร้อมเพย์ |

## ติดตั้ง (ทำตามลำดับ)

### 1. Supabase
1. สร้างโปรเจกต์ที่ supabase.com
2. ไปที่ **SQL Editor** → วางไฟล์ `supabase/schema.sql` ทั้งหมด → **Run**
3. ไปที่ **Project Settings → API** จด `Project URL` และ `service_role` key (หรือ secret key `sb_secret_...`)

> แก้สต็อกรายวัน: Table Editor → `supply` → แก้ช่อง `remaining`
> ปิดขายเมนูชั่วคราว: `products` → `is_active` = false

### 2. Google Sheet
ทำตามคอมเมนต์ด้านบนไฟล์ `google-sheet/Code.gs` (สร้างชีต → Apps Script → วางโค้ด → Run `setup` → Deploy เป็น Web app)

หัวตารางในแท็บ **ออเดอร์**:

| เลขออเดอร์ | วันเวลา | ชื่อลูกค้า | เบอร์โทร | ที่อยู่จัดส่ง | รายการอาหาร | จำนวนจาน | ยอดรวม (บาท) | หมายเหตุ | สถานะ | Order ID | สลิป | ผลตรวจสลิป |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

ออเดอร์ใหม่และสลิปที่เข้ามา จะส่งอีเมลแจ้งเจ้าของชีตด้วย (ตั้งที่ `NOTIFY_EMAIL` ใน Code.gs)

ช่อง **สถานะ** เป็น dropdown เปลี่ยนจากแอป Google Sheets ในมือถือได้

### 3. รันในเครื่อง
```bash
npm install
cp .env.example .env.local   # แล้วกรอกค่า
npm run dev                  # เปิด http://localhost:3000
```

### 4. Deploy ขึ้น Vercel
1. push โค้ดขึ้น GitHub
2. Vercel → **Add New Project** → เลือก repo
3. **Environment Variables** → ใส่ทุกตัวตาม `.env.example`
4. **Deploy**

## Environment variables

| ชื่อ | จำเป็น | คืออะไร |
|---|---|---|
| `SUPABASE_URL` | ✓ | URL โปรเจกต์ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | service role / secret key (ใช้ฝั่ง server เท่านั้น) |
| `PROMPTPAY_ID` | ✓ | เบอร์พร้อมเพย์ 10 หลัก หรือเลขบัตร 13 หลัก |
| `GOOGLE_SHEET_WEBHOOK_URL` | ✓ | Web app URL ของ Apps Script |
| `GOOGLE_SHEET_SECRET` | ✓ | ต้องตรงกับ `SECRET` ใน Code.gs |
| `EASYSLIP_API_KEY` | | ตรวจสลิปอัตโนมัติ (developer.easyslip.com) ไม่ใส่ = ร้านตรวจเอง |
| `SHOP_BANK_ACCOUNT` | | เลขบัญชีร้าน ใช้เช็กผู้รับเงินบนสลิป |
| `NEXT_PUBLIC_CONTACT_URL` | | ลิงก์ LINE/Messenger ให้ลูกค้าทักร้าน |

ถ้าไม่ใส่ค่า Sheet ออเดอร์ยังเข้า Supabase ปกติ แต่จะไม่ขึ้นในชีต

## ความปลอดภัย
- เปิด RLS ทุกตาราง ไม่มี policy → อ่าน/เขียนจาก browser ตรง ๆ ไม่ได้ ต้องผ่าน server เท่านั้น
- ราคาคิดใหม่ฝั่ง server ทุกครั้ง แก้ราคาใน browser ไม่มีผล
- ตัดสต็อกแบบล็อกแถว (`place_order`) → คนสั่งพร้อมกันไม่ทำให้สต็อกติดลบ
- Apps Script เช็ก secret ก่อนเขียนชีต
- หน้าออเดอร์เข้าด้วย UUID เดาไม่ได้

## ข้อจำกัด (ตั้งใจไม่ทำ)
- ไม่มี payment gateway: ลูกค้าโอนเองแล้วส่งสลิป ร้านเปลี่ยนสถานะเอง
- ไม่คำนวณค่าส่ง
- สถานะที่แก้ใน Google Sheet ไม่ย้อนกลับไปที่หน้าเว็บ (หน้าเว็บอ่านจาก Supabase)
- รองรับคนใช้ระดับหลักร้อยถึงหลักพันต่อวันบน free tier ของ Vercel + Supabase
