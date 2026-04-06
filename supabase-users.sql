-- شغّل هذا في Supabase → SQL Editor

-- جدول المستخدمين
create table if not exists app_users (
  id         bigserial primary key,
  username   text unique not null,
  password   text not null,
  role       text default 'viewer',
  name       text,
  email      text,
  created_at timestamptz default now()
);

-- تفعيل RLS
alter table app_users enable row level security;

-- السماح للجميع (الحماية في التطبيق)
create policy "allow_all" on app_users for all using (true) with check (true);

-- المستخدم الأساسي
insert into app_users (username, password, role, name, email)
values ('Badr', 'BADR050982538', 'admin', 'Badr', 'admin@netexpert.com')
on conflict (username) do nothing;
