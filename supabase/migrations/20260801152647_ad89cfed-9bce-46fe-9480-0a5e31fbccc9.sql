DELETE FROM public.comms_digest_items
WHERE id IN (
  '7819b522-e1d6-4787-8747-c1f686c53ac2',
  '5a26d079-2f27-4b93-a41a-568604e24aa2',
  '8f108820-8e1e-4919-a887-f565208c9488',
  'f862610d-d5ad-49f0-bddd-fff79608107a',
  '55c57fa8-141d-41c9-950b-f0821b3fd7ab'
)
AND source_id = '8e255ea5-f218-4c80-aaf1-a6f09e85dfee'
AND digest_send_id IS NULL;