ALTER TABLE public.agent_verification_audit
  DROP CONSTRAINT IF EXISTS agent_verification_audit_action_check;
ALTER TABLE public.agent_verification_audit
  ADD CONSTRAINT agent_verification_audit_action_check
  CHECK (action = ANY (ARRAY['verified'::text, 'rejected'::text, 'restricted'::text, 'reverted'::text, 'pending'::text, 'invited'::text]));