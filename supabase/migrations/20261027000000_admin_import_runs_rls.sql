-- Allow only authenticated Streamly admins to read and maintain import history.
-- This fixes manual imports failing when creating the import_runs record while
-- keeping import history unavailable to ordinary authenticated users.
alter table public.import_runs enable row level security;

drop policy if exists "Admins can read import runs" on public.import_runs;
create policy "Admins can read import runs"
  on public.import_runs
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can create import runs" on public.import_runs;
create policy "Admins can create import runs"
  on public.import_runs
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update import runs" on public.import_runs;
create policy "Admins can update import runs"
  on public.import_runs
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
