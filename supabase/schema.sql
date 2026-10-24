-- =====================================================================
-- กะเพราไฟลุก — Supabase schema
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์นี้ → Run
-- (รันซ้ำได้ ไม่พัง แต่จะรีเซ็ตเมนู/สต็อกกลับเป็นค่าเริ่มต้น)
-- =====================================================================

-- ---------- 1) supply : วัตถุดิบเนื้อสัตว์ที่เหลือ (นับเป็น "จาน") ----------
create table if not exists public.supply (
  id               serial primary key,
  name             text not null unique,          -- เช่น หมูสับ, กุ้ง
  remaining        integer not null default 0     -- เหลือทำได้อีกกี่จาน
                   check (remaining >= 0),
  low_stock_alert  integer not null default 5,    -- เกณฑ์ของใกล้หมด (ตอนนี้ยังไม่ได้ใช้แจ้งเตือน)
  updated_at       timestamptz not null default now()
);

-- ---------- 2) products : เมนูกะเพรา ----------
create table if not exists public.products (
  id           serial primary key,
  slug         text not null unique,              -- ใช้ทำ URL เช่น /menu/pork-minced
  name         text not null,
  description  text not null default '',
  category     text not null
               check (category in ('pork','poultry','beef','seafood','other')),
  price        integer not null check (price > 0), -- บาท
  supply_id    integer not null references public.supply(id),
  image_url    text,                               -- ใส่ทีหลังได้ (Supabase Storage)
  is_active    boolean not null default true,
  sort_order   integer not null default 0
);

-- ---------- 3) orders : ออเดอร์ ----------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       bigint generated always as identity,   -- เลขออเดอร์ #1, #2, ...
  customer_name  text not null,
  phone          text not null,
  address        text not null,
  note           text not null default '',
  items          jsonb not null,      -- [{product_id,name,qty,unit_price,options,line_total}]
  total          integer not null check (total >= 0),
  status         text not null default 'รอชำระเงิน'
                 check (status in ('รอชำระเงิน','รอตรวจสลิป','ชำระแล้ว','กำลังทำ','จัดส่งแล้ว','ยกเลิก')),
  created_at     timestamptz not null default now(),
  -- สลิปโอนเงิน (ลูกค้าแนบจากหน้า /order/[id])
  slip_path      text,                -- path ใน Storage bucket "slips"
  slip_hash      text unique,         -- sha256 ของไฟล์ กันส่งรูปสลิปเดิมซ้ำ
  slip_ref       text unique,         -- เลขอ้างอิงธุรกรรมจากธนาคาร (ถ้าตรวจอัตโนมัติ) กันใช้สลิปซ้ำ
  slip_result    text,                -- ผลตรวจล่าสุด
  slip_at        timestamptz,
  paid_at        timestamptz
);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- ---------- Storage : เก็บรูปสลิป (private — เปิดดูได้ผ่าน signed URL เท่านั้น) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slips', 'slips', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- ---------- RLS : ปิดทุกอย่างจากฝั่ง browser ----------
-- เว็บอ่าน/เขียนผ่าน server (service role key) เท่านั้น
-- anon key หลุดไปก็อ่านออเดอร์ลูกค้าไม่ได้
alter table public.supply   enable row level security;
alter table public.products enable row level security;
alter table public.orders   enable row level security;

-- ---------- place_order : ตัดสต็อก + สร้างออเดอร์ ในทรานแซกชันเดียว ----------
-- ถ้าวัตถุดิบไม่พอ จะ error ทั้งก้อน ไม่มีการตัดสต็อกครึ่ง ๆ กลาง ๆ
create or replace function public.place_order(
  p_customer jsonb,   -- {name, phone, address, note}
  p_items    jsonb,   -- [{product_id, supply_id, name, qty, unit_price, options, line_total}]
  p_total    integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item     jsonb;
  v_need     record;
  v_left     integer;
  v_order    public.orders;
  v_low      jsonb := '[]'::jsonb;
begin
  -- รวมจำนวนจานที่ต้องใช้ต่อวัตถุดิบ แล้วล็อกแถว supply ตามลำดับ id (กัน deadlock)
  for v_need in
    select (i->>'supply_id')::int as supply_id, sum((i->>'qty')::int) as qty
    from jsonb_array_elements(p_items) i
    group by 1
    order by 1
  loop
    update public.supply
       set remaining = remaining - v_need.qty,
           updated_at = now()
     where id = v_need.supply_id
       and remaining >= v_need.qty
    returning remaining into v_left;

    if not found then
      raise exception 'OUT_OF_STOCK:%',
        (select name from public.supply where id = v_need.supply_id);
    end if;

    if v_left <= (select low_stock_alert from public.supply where id = v_need.supply_id) then
      v_low := v_low || jsonb_build_object(
        'name', (select name from public.supply where id = v_need.supply_id),
        'remaining', v_left);
    end if;
  end loop;

  insert into public.orders (customer_name, phone, address, note, items, total)
  values (
    p_customer->>'name',
    p_customer->>'phone',
    p_customer->>'address',
    coalesce(p_customer->>'note', ''),
    p_items,
    p_total
  )
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'order_no', v_order.order_no,
    'created_at', v_order.created_at,
    'low_stock', v_low
  );
end;
$$;

-- ให้เรียกได้จาก server (service_role) เท่านั้น
revoke all on function public.place_order(jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.place_order(jsonb, jsonb, integer) to service_role;

-- =====================================================================
-- ข้อมูลเริ่มต้น (seed)
-- =====================================================================
truncate public.products restart identity cascade;
truncate public.supply restart identity cascade;

insert into public.supply (name, remaining, low_stock_alert) values
  ('หมูสับ',        60, 10),
  ('หมูกรอบ',       30, 5),
  ('หมูชิ้น',        40, 8),
  ('ไก่สับ',         60, 10),
  ('ไก่ชิ้น',        40, 8),
  ('เป็ด',          20, 5),
  ('เนื้อสับ',       30, 5),
  ('เนื้อชิ้น',       30, 5),
  ('เนื้อวากิว A5',   5, 2),
  ('กุ้ง',           30, 5),
  ('หมึก',          30, 5),
  ('หอยลาย',       20, 5),
  ('ทะเลรวม',       20, 5),
  ('ปลาดุกฟู',       20, 5),
  ('ไข่เยี่ยวม้า',     25, 5);

insert into public.products (slug, name, description, category, price, supply_id, sort_order)
select v.slug, v.name, v.description, v.category, v.price, s.id, v.sort_order
from (values
  ('pork-minced',   'กะเพราหมูสับ',     'หมูสับผัดไฟแรง ใบกะเพราเยอะ พริกกระเทียมตำสด',              'pork',     50, 'หมูสับ',      1),
  ('pork-crispy',   'กะเพราหมูกรอบ',    'หมูกรอบหนังพองทอดใหม่ คลุกซอสทีหลังให้ยังกรอบ',             'pork',     70, 'หมูกรอบ',     2),
  ('pork-sliced',   'กะเพราหมูชิ้น',     'หมูสันในหั่นบาง หมักนิดเดียวให้นุ่ม',                       'pork',     55, 'หมูชิ้น',      3),
  ('chicken-minced','กะเพราไก่สับ',      'ไก่สับผัดแห้ง ๆ หอมกระเทียมเจียว',                          'poultry',  50, 'ไก่สับ',       4),
  ('chicken-sliced','กะเพราไก่ชิ้น',     'สะโพกไก่หั่นชิ้น ไม่แห้ง เคี้ยวเพลิน',                       'poultry',  55, 'ไก่ชิ้น',      5),
  ('duck',          'กะเพราเป็ด',       'เป็ดย่างสับชิ้น ผัดกับพริกสดและพริกไทยอ่อน',                'poultry',  70, 'เป็ด',        6),
  ('beef-minced',   'กะเพราเนื้อสับ',    'เนื้อวัวสับเอง ไม่ผสมมัน ผัดจนหอมไหม้นิด ๆ',               'beef',     70, 'เนื้อสับ',     7),
  ('beef-sliced',   'กะเพราเนื้อชิ้น',    'เนื้อวัวหั่นบางสวนเส้นใย นุ่มไม่เหนียว',                     'beef',     75, 'เนื้อชิ้น',     8),
  ('wagyu-a5',      'กะเพราเนื้อวากิว A5','วากิว A5 ย่างแยก วางบนกะเพราไม่ผัดรวม ให้มันละลายบนข้าว จำกัดวันละ 5 จาน', 'beef', 390, 'เนื้อวากิว A5', 9),
  ('shrimp',        'กะเพรากุ้ง',        'กุ้งขาวตัวโต ผ่าหลัง ผัดพอสุกให้เด้ง',                       'seafood',  80, 'กุ้ง',        10),
  ('squid',         'กะเพราหมึก',       'หมึกกล้วยหั่นแหวน ผัดเร็วไม่ให้เหนียว',                       'seafood',  75, 'หมึก',       11),
  ('clam',          'กะเพราหอยลาย',     'หอยลายสด ผัดน้ำน้อย ๆ ซอสเข้าเนื้อหอย',                       'seafood',  65, 'หอยลาย',    12),
  ('seafood-mix',   'กะเพราทะเลรวม',    'กุ้ง หมึก หอย จัดเต็มจานเดียว',                              'seafood',  95, 'ทะเลรวม',    13),
  ('catfish',       'กะเพราปลาดุกฟู',    'ปลาดุกฟูกรอบ ๆ ราดกะเพราแห้ง เผ็ดหอม',                       'other',    65, 'ปลาดุกฟู',    14),
  ('century-egg',   'กะเพราไข่เยี่ยวม้า',  'ไข่เยี่ยวม้าชุบแป้งทอดกรอบ ผัดกะเพรา',                        'other',    55, 'ไข่เยี่ยวม้า',   15)
) as v(slug, name, description, category, price, supply_name, sort_order)
join public.supply s on s.name = v.supply_name;

-- รูปเมนู (Unsplash — ใช้เชิงพาณิชย์ได้ฟรี) เปลี่ยนเป็นรูปจริงของร้านทีหลังได้
update public.products p set image_url = v.url from (values
  ('pork-minced', 'https://images.unsplash.com/photo-1627308595186-e6bb36712645?auto=format&fit=crop&w=900&h=675&q=75'),
  ('pork-crispy', 'https://images.unsplash.com/photo-1573403707306-a29ab9b24686?auto=format&fit=crop&w=900&h=675&q=75'),
  ('pork-sliced', 'https://images.unsplash.com/photo-1669863329825-6e4e39ce752c?auto=format&fit=crop&w=900&h=675&q=75'),
  ('chicken-minced', 'https://images.unsplash.com/photo-1652615390228-99398884624d?auto=format&fit=crop&w=900&h=675&q=75'),
  ('chicken-sliced', 'https://images.unsplash.com/photo-1629606600908-a51ec6c44fdd?auto=format&fit=crop&w=900&h=675&q=75'),
  ('duck', 'https://images.unsplash.com/photo-1759418661781-2b37f26c4573?auto=format&fit=crop&w=900&h=675&q=75'),
  ('beef-minced', 'https://images.unsplash.com/photo-1652615389989-fa324011f9c1?auto=format&fit=crop&w=900&h=675&q=75'),
  ('beef-sliced', 'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?auto=format&fit=crop&w=900&h=675&q=75'),
  ('wagyu-a5', 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=900&h=675&q=75'),
  ('shrimp', 'https://images.unsplash.com/photo-1644131447380-6f88607451bb?auto=format&fit=crop&w=900&h=675&q=75'),
  ('squid', 'https://images.unsplash.com/photo-1741243413751-e76e69f58d80?auto=format&fit=crop&w=900&h=675&q=75'),
  ('clam', 'https://images.unsplash.com/photo-1605490275087-761d2f8e56fe?auto=format&fit=crop&w=900&h=675&q=75'),
  ('seafood-mix', 'https://images.unsplash.com/photo-1704969722370-6cf3b314619b?auto=format&fit=crop&w=900&h=675&q=75'),
  ('catfish', 'https://images.unsplash.com/photo-1677366827953-315db98495e6?auto=format&fit=crop&w=900&h=675&q=75'),
  ('century-egg', 'https://images.unsplash.com/photo-1586128743915-ec7788189715?auto=format&fit=crop&w=900&h=675&q=75')
) as v(slug, url) where p.slug = v.slug;
