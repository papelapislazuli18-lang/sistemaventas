create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text not null,
  category text not null,
  cost numeric(12,2) not null default 0,
  price numeric(12,2) not null default 0,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_date date not null default current_date,
  reference text,
  expenses numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id),
  product_id uuid references public.products(id),
  sale_date date not null default current_date,
  quantity integer not null,
  total numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.purchases enable row level security;
alter table public.sales enable row level security;

drop policy if exists "own profiles" on public.profiles;
create policy "own profiles" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

do $$ declare table_name text; begin
  foreach table_name in array array['products','customers','purchases','sales'] loop
    execute format('drop policy if exists "own %s" on public.%I', table_name, table_name);
    execute format('create policy "own %s" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name, table_name);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, name) values (new.id, new.email); return new; end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
