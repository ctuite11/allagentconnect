DELETE FROM public.comms_digest_items
WHERE digest_send_id IS NULL
  AND created_at >= '2026-08-05 01:21:00+00'
  AND created_at <= '2026-08-05 01:29:59+00'
  AND id IN (
    '87afcc99-2f8e-411d-aaf2-f17aa9bd80c1',
    '7fc42a53-2676-4042-8f70-ed5e012ce4e9',
    'fd5b1bf3-e94a-4954-94ce-e17f47db1784',
    '5b56feaf-3887-42d2-94e1-4f29e0b93f71',
    '374f8957-fe80-4447-9e95-d32d1be04fa9',
    'e727ddc5-40a3-440d-8a34-62dca70c6bd9',
    '255756c1-8ee3-4e0f-a1d0-b45ac7fd98e4',
    '4f16cb76-b32f-4dbb-ace7-ee2a1fce1763',
    '2eb98517-45ab-4d3c-b34b-fccf1fc249c0',
    '7030debe-5cee-4d93-a185-a4b0f5e4dbb8',
    '1e2d197f-9828-4d99-9811-fa6866f204d3',
    '40c5827e-de81-41eb-931c-a453784c5cef'
  );

SELECT cron.alter_job(9, active := true);