select set_config('request.jwt.claim.role','service_role',true);
update public.developments
set publish_status = 'paused'
where id = 'd0000000-0000-4000-8000-000000000001'::uuid
  and publish_status = 'published';