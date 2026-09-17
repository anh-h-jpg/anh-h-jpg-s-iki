// SQL Schema and Setup definition for Supabase project matching User's Exact Configuration
export const SUPABASE_SETUP_SQL = `-- ============================================================
-- FULL SETUP: chạy 1 lần từ đầu đến cuối trong Supabase SQL Editor
-- Trước khi chạy: Dashboard > Authentication > Providers >
-- bật "Anonymous Sign-ins"
-- ============================================================

-- PHẦN 1: TẠO BẢNG GỐC
-- ------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text,
  role text not null default 'staff',        -- staff | admin | kitchen
  transfer_code text unique,                  -- vd: U012, dùng làm nội dung chuyển khoản
  created_at timestamptz default now()
);

create table if not exists weekly_menus (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  locked_at timestamptz,
  created_by uuid references users(id)
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  weekly_menu_id uuid references weekly_menus(id) on delete cascade,
  day_of_week text not null,
  name text not null,
  price integer not null
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  menu_item_id uuid references menu_items(id),
  quantity integer not null check (quantity > 0),
  updated_at timestamptz default now(),
  unique (user_id, menu_item_id)              -- chống đặt trùng/đè nhau
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  weekly_menu_id uuid references weekly_menus(id),
  amount_due integer not null default 0,
  status text not null default 'unpaid',       -- unpaid | paid
  method text,
  confirmed_by text,
  confirmed_at timestamptz,
  bank_ref text
);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  menu_item_id uuid references menu_items(id),
  rating integer check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

-- PHẦN 2: LIÊN KẾT AUTH + RLS + VIEWS + RPC
-- ------------------------------------------------------------
alter table users add column if not exists auth_uid uuid unique;

alter table users enable row level security;
alter table weekly_menus enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table feedback enable row level security;

create or replace function auth_user_id() returns uuid
language sql stable security definer as $$
  select id from users where auth_uid = auth.uid() limit 1;
$$;

create or replace function auth_user_role() returns text
language sql stable security definer as $$
  select role from users where auth_uid = auth.uid() limit 1;
$$;

create or replace function claim_profile(target_user_id uuid)
returns users
language plpgsql
security definer
as $$
declare
  result users;
begin
  update users
  set auth_uid = auth.uid()
  where id = target_user_id
  returning * into result;
  return result;
end;
$$;

-- Policies: Cho phép ứng dụng đọc và ghi trực tiếp (tránh lỗi RLS 42501)
drop policy if exists "users_select_all" on users;
create policy "users_select_all" on users for select using (true);

drop policy if exists "users_insert_all" on users;
create policy "users_insert_all" on users for insert with check (true);

drop policy if exists "users_update_all" on users;
create policy "users_update_all" on users for update using (true);

drop policy if exists "weekly_menus_select_all" on weekly_menus;
create policy "weekly_menus_select_all" on weekly_menus for select using (true);

drop policy if exists "weekly_menus_all" on weekly_menus;
create policy "weekly_menus_all" on weekly_menus for all using (true) with check (true);

drop policy if exists "menu_items_select_all" on menu_items;
create policy "menu_items_select_all" on menu_items for select using (true);

drop policy if exists "menu_items_all" on menu_items;
create policy "menu_items_all" on menu_items for all using (true) with check (true);

drop policy if exists "orders_all" on orders;
create policy "orders_all" on orders for all using (true) with check (true);

drop policy if exists "payments_all" on payments;
create policy "payments_all" on payments for all using (true) with check (true);

drop policy if exists "feedback_all" on feedback;
create policy "feedback_all" on feedback for all using (true) with check (true);

-- Đảm bảo constraint unique cho payments (user_id, weekly_menu_id)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_user_week_unique'
  ) then
    alter table payments add constraint payments_user_week_unique unique (user_id, weekly_menu_id);
  end if;
end $$;

-- View: kitchen_summary
create or replace view kitchen_summary
with (security_invoker = true) as
select
  wm.id as weekly_menu_id,
  wm.week_start,
  mi.id as menu_item_id,
  mi.day_of_week,
  mi.name as item_name,
  coalesce(sum(o.quantity), 0)::integer as total_quantity
from weekly_menus wm
join menu_items mi on mi.weekly_menu_id = wm.id
left join orders o on o.menu_item_id = mi.id
group by wm.id, wm.week_start, mi.id, mi.day_of_week, mi.name
order by wm.week_start desc, mi.day_of_week, mi.name;

-- View: payment_status_admin
create or replace view payment_status_admin
with (security_invoker = true) as
select
  u.id as user_id,
  u.name,
  u.department,
  u.transfer_code,
  p.id as payment_id,
  p.weekly_menu_id,
  coalesce(p.amount_due, 0) as amount_due,
  coalesce(p.status, 'unpaid') as status,
  p.method,
  p.confirmed_by,
  p.confirmed_at
from users u
left join payments p on p.user_id = u.id
where u.role = 'staff'
order by u.name;

-- Stored Procedure: generate_payments
create or replace function generate_payments(p_weekly_menu_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if auth_user_role() <> 'admin' then
    raise exception 'not authorized';
  end if;

  insert into payments (user_id, weekly_menu_id, amount_due, status)
  select o.user_id, p_weekly_menu_id, sum(mi.price * o.quantity), 'unpaid'
  from orders o
  join menu_items mi on mi.id = o.menu_item_id
  where mi.weekly_menu_id = p_weekly_menu_id
  group by o.user_id
  on conflict (user_id, weekly_menu_id)
  do update set amount_due = excluded.amount_due;
end;
$$;

-- Stored Procedure: confirm_payment
create or replace function confirm_payment(p_payment_id uuid, p_confirmed_by text)
returns void
language plpgsql
security definer
as $$
begin
  if auth_user_role() <> 'admin' then
    raise exception 'not authorized';
  end if;

  update payments
  set status = 'paid',
      method = coalesce(method, 'cash'),
      confirmed_by = p_confirmed_by,
      confirmed_at = now()
  where id = p_payment_id;
end;
$$;

-- Bật publication realtime cho orders
do $$
begin
  alter publication supabase_realtime add table orders;
exception
  when duplicate_object then null;
end $$;
`;

export const SUPABASE_SEED_SQL = `-- ============================================================
-- SEED DATA: dữ liệu mẫu để test (chạy SAU khi đã chạy full_setup.sql)
-- Chạy trong Supabase SQL Editor
-- ============================================================

-- PHẦN 1: USERS MẪU
-- ------------------------------------------------------------
-- auth_uid để NULL — người dùng thật sẽ tự "claim" hồ sơ này
-- (qua RPC claim_profile) khi họ đăng nhập lần đầu trên app.

insert into users (name, department, role, transfer_code) values
  ('Admin Test',      'Vận hành', 'admin',   null),
  ('Bếp Test',        'Bếp',      'kitchen', null),
  ('Nguyễn Văn A',    'Kinh doanh', 'staff', 'U001'),
  ('Trần Thị B',      'Kỹ thuật',   'staff', 'U002'),
  ('Lê Văn C',        'Kỹ thuật',   'staff', 'U003'),
  ('Phạm Thị D',      'Nhân sự',    'staff', 'U004'),
  ('Hoàng Văn E',     'Kinh doanh', 'staff', 'U005')
on conflict (transfer_code) do nothing;

-- PHẦN 2: MENU TUẦN MẪU (Thứ 2 - Thứ 6)
-- ------------------------------------------------------------
-- Đổi giá trị week_start bên dưới thành ngày Thứ 2 bạn muốn test
-- (mặc định: Thứ 2 gần nhất kể từ hôm nay).

do $$
declare
  v_admin_id uuid;
  v_menu_id  uuid;
begin
  -- Lấy id của admin vừa tạo ở trên để gán created_by
  select id into v_admin_id from users where transfer_code is null and role = 'admin' limit 1;

  -- Tạo 1 tuần menu mới (Thứ 2 tuần hiện tại)
  insert into weekly_menus (week_start, created_by)
  values (date_trunc('week', current_date)::date, v_admin_id)
  returning id into v_menu_id;

  -- Món ăn cho từng ngày (2 món/ngày, giá bằng VNĐ)
  insert into menu_items (weekly_menu_id, day_of_week, name, price) values
    (v_menu_id, 'monday',    'Cơm sườn nướng',        35000),
    (v_menu_id, 'monday',    'Cơm gà xối mỡ',         35000),
    (v_menu_id, 'tuesday',   'Bún bò Huế',            40000),
    (v_menu_id, 'tuesday',   'Cơm cá kho tộ',         35000),
    (v_menu_id, 'wednesday', 'Cơm tấm bì chả',        35000),
    (v_menu_id, 'wednesday', 'Phở bò',                40000),
    (v_menu_id, 'thursday',  'Cơm gà chiên nước mắm', 35000),
    (v_menu_id, 'thursday',  'Bún riêu',              35000),
    (v_menu_id, 'friday',    'Cơm sườn bì chả',       35000),
    (v_menu_id, 'friday',    'Mì xào hải sản',        40000);

  raise notice 'Đã tạo weekly_menu id = %, week_start = %', v_menu_id, date_trunc('week', current_date)::date;
end $$;

-- ============================================================
-- KIỂM TRA NHANH SAU KHI CHẠY:
-- select * from users order by role, transfer_code;
-- select * from weekly_menus;
-- select * from menu_items order by day_of_week, name;
-- select * from kitchen_summary;
-- ============================================================
`;

export const SUPABASE_FIX_RLS_SQL = `-- ============================================================
-- SỬA LỖI RLS 42501 (CHẠY TRONG SUPABASE SQL EDITOR > RUN)
-- Mở quyền Đọc & Ghi cho các bảng để App hoạt động không bị chặn RLS 42501
-- ============================================================

-- 1. BẢNG USERS: Cho phép đọc danh sách nhân viên và tạo tài khoản
DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_all" ON public.users;
CREATE POLICY "users_insert_all" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "users_update_claim" ON public.users;
DROP POLICY IF EXISTS "users_update_all" ON public.users;
CREATE POLICY "users_update_all" ON public.users FOR UPDATE USING (true);

-- 2. BẢNG WEEKLY_MENUS & MENU_ITEMS: Cho phép xem và quản lý thực đơn
DROP POLICY IF EXISTS "weekly_menus_select_all" ON public.weekly_menus;
CREATE POLICY "weekly_menus_select_all" ON public.weekly_menus FOR SELECT USING (true);

DROP POLICY IF EXISTS "weekly_menus_admin_write" ON public.weekly_menus;
DROP POLICY IF EXISTS "weekly_menus_all" ON public.weekly_menus;
CREATE POLICY "weekly_menus_all" ON public.weekly_menus FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "menu_items_select_all" ON public.menu_items;
CREATE POLICY "menu_items_select_all" ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "menu_items_admin_write" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_all" ON public.menu_items;
CREATE POLICY "menu_items_all" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

-- 3. BẢNG ORDERS (ĐẶT CƠM): Cho phép đọc, thêm, sửa, xóa món đặt
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_own" ON public.orders;
DROP POLICY IF EXISTS "orders_all" ON public.orders;
CREATE POLICY "orders_all" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 4. BẢNG PAYMENTS & FEEDBACK
DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_admin_write" ON public.payments;
DROP POLICY IF EXISTS "payments_all" ON public.payments;
CREATE POLICY "payments_all" ON public.payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "feedback_insert_own" ON public.feedback;
DROP POLICY IF EXISTS "feedback_select" ON public.feedback;
DROP POLICY IF EXISTS "feedback_all" ON public.feedback;
CREATE POLICY "feedback_all" ON public.feedback FOR ALL USING (true) WITH CHECK (true);

-- 5. Cấp quyền truy cập cho anon và authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
`;

