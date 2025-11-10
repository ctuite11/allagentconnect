-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Agents can view their own templates and default templates
CREATE POLICY "Agents can view their own templates"
ON public.email_templates
FOR SELECT
USING (auth.uid() = agent_id OR is_default = true);

-- Agents can insert their own templates
CREATE POLICY "Agents can insert their own templates"
ON public.email_templates
FOR INSERT
WITH CHECK (auth.uid() = agent_id AND is_default = false);

-- Agents can update their own templates (not defaults)
CREATE POLICY "Agents can update their own templates"
ON public.email_templates
FOR UPDATE
USING (auth.uid() = agent_id AND is_default = false);

-- Agents can delete their own templates (not defaults)
CREATE POLICY "Agents can delete their own templates"
ON public.email_templates
FOR DELETE
USING (auth.uid() = agent_id AND is_default = false);

-- Add trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Insert default templates (using a system agent_id that will be replaced)
-- We'll use 00000000-0000-0000-0000-000000000000 as placeholder
INSERT INTO public.email_templates (agent_id, name, subject, body, category, is_default) VALUES
(
  '00000000-0000-0000-0000-000000000000',
  'Just Listed',
  'New Listing Alert: {property_address}',
  E'Hi {client_name},\n\nI''m excited to share that I just listed a new property that might interest you!\n\n📍 Address: {property_address}\n💰 Price: {property_price}\n🏠 Type: {property_type}\n🛏️ Bedrooms: {bedrooms}\n🛁 Bathrooms: {bathrooms}\n\nThis property just hit the market and I wanted you to be among the first to know. Properties like this tend to move quickly, so if you''re interested, let me know and we can schedule a showing.\n\nView the full listing: {listing_url}\n\nBest regards,\n{agent_name}\n{agent_phone}\n{agent_email}',
  'just_listed',
  true
),
(
  '00000000-0000-0000-0000-000000000000',
  'Just Sold',
  'SOLD: {property_address}',
  E'Hi {client_name},\n\nGreat news! The property at {property_address} has just SOLD!\n\n💰 Sale Price: {property_price}\n📅 Days on Market: {days_on_market}\n\nThis is a great indicator of the current market activity in this area. If you''ve been thinking about buying or selling, now might be a great time to make your move.\n\nI''d be happy to discuss what this sale means for you and your real estate goals. Feel free to reach out anytime.\n\nBest regards,\n{agent_name}\n{agent_phone}\n{agent_email}',
  'just_sold',
  true
),
(
  '00000000-0000-0000-0000-000000000000',
  'Market Update Newsletter',
  'Your Monthly Market Update - {current_month}',
  E'Hi {client_name},\n\nI hope this message finds you well! Here''s your monthly real estate market update.\n\n📊 Market Highlights:\n• Average home prices are {market_trend}\n• Inventory levels are {inventory_status}\n• Average days on market: {avg_days_on_market}\n\n🏡 What This Means For You:\nWhether you''re thinking of buying or selling, I''m here to help you navigate the current market conditions and achieve your real estate goals.\n\n💡 Did You Know?\n{market_tip}\n\nLet''s connect if you''d like to discuss how these market trends affect your specific situation.\n\nBest regards,\n{agent_name}\n{agent_phone}\n{agent_email}',
  'newsletter',
  true
),
(
  '00000000-0000-0000-0000-000000000000',
  'Price Reduction Alert',
  'Price Reduced: {property_address}',
  E'Hi {client_name},\n\nGreat news! The price has been reduced on a property you might be interested in:\n\n📍 Address: {property_address}\n💵 New Price: {new_price} (was {old_price})\n💰 Savings: {price_difference}\n🛏️ Bedrooms: {bedrooms}\n🛁 Bathrooms: {bathrooms}\n\nThis price reduction represents an excellent opportunity. Properties with price adjustments often generate renewed interest, so if you''re interested, let''s act quickly.\n\nView the listing: {listing_url}\n\nWould you like to schedule a showing?\n\nBest regards,\n{agent_name}\n{agent_phone}\n{agent_email}',
  'price_reduction',
  true
);

-- Create index for better query performance
CREATE INDEX idx_email_templates_agent_id ON public.email_templates(agent_id);
CREATE INDEX idx_email_templates_category ON public.email_templates(category);