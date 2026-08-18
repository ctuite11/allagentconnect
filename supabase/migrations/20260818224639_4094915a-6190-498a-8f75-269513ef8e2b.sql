create or replace function public.admin_list_developer_access_requests(_status text default 'all')
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  website text,
  project_name text,
  market text,
  note text,
  status text,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz,
  provisioned_user_id uuid,
  provisioned_account_id uuid,
  activated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.first_name, r.last_name, r.email, r.phone, r.company_name,
         r.website, r.project_name, r.market, r.note, r.status, r.review_notes,
         r.reviewed_at, r.created_at, r.provisioned_user_id, r.provisioned_account_id,
         (
           select max(t.redeemed_at)
           from public.agent_activation_tokens t
           where t.user_id = r.provisioned_user_id
             and t.redeemed_at is not null
         ) as activated_at
  from public.developer_access_requests r
  where public.has_role(auth.uid(), 'admin'::app_role)
    and (_status = 'all' or r.status = _status)
  order by r.created_at desc
$$;

revoke all on function public.admin_list_developer_access_requests(text) from public;
grant execute on function public.admin_list_developer_access_requests(text) to authenticated;