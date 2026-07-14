ALTER TABLE public.notification_preferences ALTER COLUMN buyer_need SET DEFAULT true;
ALTER TABLE public.notification_preferences ALTER COLUMN renter_need SET DEFAULT true;
ALTER TABLE public.notification_preferences ALTER COLUMN sales_intel SET DEFAULT true;
ALTER TABLE public.notification_preferences ALTER COLUMN general_discussion SET DEFAULT true;

UPDATE public.notification_preferences
SET buyer_need = true,
    renter_need = true,
    sales_intel = true,
    general_discussion = true
WHERE buyer_need = false
   OR renter_need = false
   OR sales_intel = false
   OR general_discussion = false;