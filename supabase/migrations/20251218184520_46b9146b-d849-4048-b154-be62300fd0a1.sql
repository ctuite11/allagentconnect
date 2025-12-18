-- Clean up test/fake users and data, keep only 4 real users
-- User IDs to KEEP:
-- Chris Tuite: 7c38e518-e660-460b-becb-5e9a026986ba
-- Betsy McCombs: 4ef7789b-20d8-40d3-9fee-3c41fae2bdc5
-- Charles Joseph: 976a874d-2c36-4799-b29e-db43604f01d8
-- Maria Carmen Vera-Diaz: 6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90

-- Step 1: Delete related data for users being removed
-- Delete clients belonging to agents being deleted
DELETE FROM public.clients 
WHERE agent_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

-- Delete hot sheets for users being deleted
DELETE FROM public.hot_sheets 
WHERE user_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

-- Delete favorites for users being deleted
DELETE FROM public.favorites 
WHERE user_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

-- Delete listing-related data for listings being deleted
DELETE FROM public.listing_stats 
WHERE listing_id IN (
  SELECT id FROM public.listings 
  WHERE agent_id NOT IN (
    '7c38e518-e660-460b-becb-5e9a026986ba',
    '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
    '976a874d-2c36-4799-b29e-db43604f01d8',
    '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
  )
);

DELETE FROM public.listing_status_history 
WHERE listing_id IN (
  SELECT id FROM public.listings 
  WHERE agent_id NOT IN (
    '7c38e518-e660-460b-becb-5e9a026986ba',
    '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
    '976a874d-2c36-4799-b29e-db43604f01d8',
    '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
  )
);

DELETE FROM public.listing_views 
WHERE listing_id IN (
  SELECT id FROM public.listings 
  WHERE agent_id NOT IN (
    '7c38e518-e660-460b-becb-5e9a026986ba',
    '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
    '976a874d-2c36-4799-b29e-db43604f01d8',
    '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
  )
);

-- Step 2: Delete orphaned listings (from agents being deleted)
DELETE FROM public.listings 
WHERE agent_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

-- Step 3: Clean up Betsy's duplicate draft listings
-- Keep only one listing per unique address for Betsy
DELETE FROM public.listings 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY address, city, state ORDER BY created_at DESC) as rn
    FROM public.listings 
    WHERE agent_id = '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5'
  ) ranked
  WHERE rn > 1
);

-- Step 4: Delete agent-related data for users being deleted
DELETE FROM public.agent_settings 
WHERE user_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

DELETE FROM public.agent_county_preferences 
WHERE agent_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

DELETE FROM public.agent_state_preferences 
WHERE agent_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

DELETE FROM public.agent_buyer_coverage_areas 
WHERE agent_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

DELETE FROM public.notification_preferences 
WHERE user_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

DELETE FROM public.user_roles 
WHERE user_id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

DELETE FROM public.agent_profiles 
WHERE id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

DELETE FROM public.profiles 
WHERE id NOT IN (
  '7c38e518-e660-460b-becb-5e9a026986ba',
  '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5',
  '976a874d-2c36-4799-b29e-db43604f01d8',
  '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90'
);

-- Step 5: Create agent_settings for the 4 kept users (if they don't have one)
INSERT INTO public.agent_settings (user_id)
VALUES 
  ('7c38e518-e660-460b-becb-5e9a026986ba'),
  ('4ef7789b-20d8-40d3-9fee-3c41fae2bdc5'),
  ('976a874d-2c36-4799-b29e-db43604f01d8'),
  ('6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90')
ON CONFLICT (user_id) DO NOTHING;