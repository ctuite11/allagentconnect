-- Add admin DELETE policies to tables missing them

-- 1. agent_profiles - admins can delete any agent profile
CREATE POLICY "Admins can delete agent profiles"
ON public.agent_profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. agent_settings - admins can delete any agent settings
CREATE POLICY "Admins can delete agent settings"
ON public.agent_settings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. profiles - admins can delete any profile
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. user_roles - admins can delete any user roles
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. listings - admins can delete any listing
CREATE POLICY "Admins can delete any listing"
ON public.listings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. clients - admins can delete any client
CREATE POLICY "Admins can delete clients"
ON public.clients
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. hot_sheets - admins can delete any hot sheet
CREATE POLICY "Admins can delete hot sheets"
ON public.hot_sheets
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. notification_preferences - admins can delete
CREATE POLICY "Admins can delete notification preferences"
ON public.notification_preferences
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. agent_buyer_coverage_areas - admins can delete
CREATE POLICY "Admins can delete agent buyer coverage areas"
ON public.agent_buyer_coverage_areas
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. agent_county_preferences - admins can delete
CREATE POLICY "Admins can delete agent county preferences"
ON public.agent_county_preferences
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 11. agent_state_preferences - admins can delete
CREATE POLICY "Admins can delete agent state preferences"
ON public.agent_state_preferences
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 12. testimonials - admins can delete
CREATE POLICY "Admins can delete testimonials"
ON public.testimonials
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 13. email_templates - admins can delete
CREATE POLICY "Admins can delete email templates"
ON public.email_templates
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 14. favorites - admins can delete
CREATE POLICY "Admins can delete favorites"
ON public.favorites
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 15. listing_drafts - admins can delete
CREATE POLICY "Admins can delete listing drafts"
ON public.listing_drafts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));