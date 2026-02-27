create index if not exists idx_email_events_created_at
on public.email_events (created_at desc);