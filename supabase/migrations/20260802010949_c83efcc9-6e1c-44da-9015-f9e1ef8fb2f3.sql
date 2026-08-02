UPDATE public.hot_sheets
SET is_active = FALSE, updated_at = now()
WHERE id IN (
  'b41d8741-04ec-4193-8b20-7bbdb4a13da2',
  '044322c7-0a7f-4b0d-bae4-d5151809b636',
  '0b2edc68-7e17-4483-b4df-cbc35f54c5fc',
  '76b4d628-fa7a-43ed-b1a5-17ef222ff85a',
  '9128adbd-5e60-423f-b71e-b0c213069a4f'
);