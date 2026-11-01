CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO PUBLIC;
ALTER TABLE public.listings ADD COLUMN city text, ADD COLUMN state text, ADD COLUMN bedrooms int, ADD COLUMN bathrooms numeric,
  ADD COLUMN square_feet int, ADD COLUMN description text, ADD COLUMN photos jsonb DEFAULT '["a/1.jpg","a/2.jpg"]';
ALTER TABLE public.agent_profiles ADD COLUMN phone text, ADD COLUMN cell_phone text, ADD COLUMN email text;
UPDATE public.agent_profiles SET email = lower(first_name)||'@fake.test';
