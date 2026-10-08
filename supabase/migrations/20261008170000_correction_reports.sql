-- Anonymous correction reports, used to evaluate extraction quality.
--
-- Privacy (CLAUDE.md): this table must never hold letter content or personal data.
-- Every column is a category or technical metadata with a fixed set of values; there is
-- no free text and no user or device identifier. A corrected value the user types stays
-- on the device.

create table public.correction_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  item_kind text not null
    check (item_kind in ('summary', 'deadline', 'action')),
  error_category text not null
    check (error_category in (
      'wrong_date', 'wrong_amount', 'not_in_letter', 'wrong_meaning', 'missing_detail', 'other'
    )),
  deadline_kind text
    check (deadline_kind in ('due_date', 'appointment', 'expiry', 'recurring', 'relative')),
  confidence text not null
    check (confidence in ('high', 'medium', 'low')),
  verification_status text not null
    check (verification_status in ('verified', 'unverified')),
  language text not null
    check (language in ('tr', 'en')),
  prompt_version text not null
    check (prompt_version ~ '^[a-z0-9.-]{1,40}$'),
  model text not null
    check (model ~ '^[A-Za-z0-9._/:-]{1,80}$'),
  -- A deadline kind only makes sense for deadline items.
  check ((item_kind = 'deadline') = (deadline_kind is not null))
);

comment on table public.correction_reports is
  'Anonymous, content-free correction reports from the app (categories only).';

alter table public.correction_reports enable row level security;

-- New tables are not exposed automatically in this project: grant exactly what the app
-- needs. Clients may insert reports but never read, change or delete them.
revoke all on table public.correction_reports from anon, authenticated;
grant insert on table public.correction_reports to anon, authenticated;

create policy "clients can submit correction reports"
  on public.correction_reports
  for insert
  to anon, authenticated
  with check (true);
