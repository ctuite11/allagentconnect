-- Create vendor profiles table
CREATE TABLE public.vendor_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  business_type TEXT NOT NULL, -- mortgage, inspection, title, contractor, etc.
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  description TEXT,
  service_areas JSONB DEFAULT '[]'::jsonb,
  is_approved BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ad packages table
CREATE TABLE public.ad_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  duration_days INTEGER NOT NULL, -- subscription duration
  ad_type TEXT NOT NULL, -- banner, featured, sidebar, directory
  features JSONB DEFAULT '[]'::jsonb,
  max_impressions INTEGER, -- null = unlimited
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendor subscriptions table
CREATE TABLE public.vendor_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.ad_packages(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, expired, pending
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create advertisements table
CREATE TABLE public.advertisements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.vendor_subscriptions(id) ON DELETE CASCADE,
  ad_type TEXT NOT NULL, -- banner, featured, sidebar, directory
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT NOT NULL,
  placement_zone TEXT, -- homepage_hero, listing_sidebar, search_results, etc.
  target_locations JSONB DEFAULT '[]'::jsonb, -- specific states/cities to target
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- higher priority shown first
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ad impressions table
CREATE TABLE public.ad_impressions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id UUID NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  viewer_id UUID,
  page_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ad clicks table
CREATE TABLE public.ad_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id UUID NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  impression_id UUID REFERENCES public.ad_impressions(id),
  viewer_ip TEXT,
  viewer_id UUID,
  page_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_clicks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendor_profiles
CREATE POLICY "Vendors can view their own profile"
  ON public.vendor_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Vendors can create their own profile"
  ON public.vendor_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Vendors can update their own profile"
  ON public.vendor_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view approved vendor profiles"
  ON public.vendor_profiles FOR SELECT
  USING (is_approved = true AND is_active = true);

-- RLS Policies for ad_packages
CREATE POLICY "Anyone can view active ad packages"
  ON public.ad_packages FOR SELECT
  USING (is_active = true);

-- RLS Policies for vendor_subscriptions
CREATE POLICY "Vendors can view their own subscriptions"
  ON public.vendor_subscriptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE vendor_profiles.id = vendor_subscriptions.vendor_id
    AND vendor_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Vendors can create their own subscriptions"
  ON public.vendor_subscriptions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE vendor_profiles.id = vendor_subscriptions.vendor_id
    AND vendor_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Vendors can update their own subscriptions"
  ON public.vendor_subscriptions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE vendor_profiles.id = vendor_subscriptions.vendor_id
    AND vendor_profiles.user_id = auth.uid()
  ));

-- RLS Policies for advertisements
CREATE POLICY "Vendors can manage their own ads"
  ON public.advertisements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.vendor_profiles
    WHERE vendor_profiles.id = advertisements.vendor_id
    AND vendor_profiles.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can view active ads"
  ON public.advertisements FOR SELECT
  USING (is_active = true);

-- RLS Policies for ad_impressions
CREATE POLICY "System can record impressions"
  ON public.ad_impressions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Vendors can view their ad impressions"
  ON public.ad_impressions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.advertisements
    JOIN public.vendor_profiles ON advertisements.vendor_id = vendor_profiles.id
    WHERE advertisements.id = ad_impressions.ad_id
    AND vendor_profiles.user_id = auth.uid()
  ));

-- RLS Policies for ad_clicks
CREATE POLICY "System can record clicks"
  ON public.ad_clicks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Vendors can view their ad clicks"
  ON public.ad_clicks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.advertisements
    JOIN public.vendor_profiles ON advertisements.vendor_id = vendor_profiles.id
    WHERE advertisements.id = ad_clicks.ad_id
    AND vendor_profiles.user_id = auth.uid()
  ));

-- Insert default ad packages
INSERT INTO public.ad_packages (name, description, price, duration_days, ad_type, features, display_order) VALUES
('Basic Directory', 'Get listed in our vendor directory with contact information and business description', 49.99, 30, 'directory', '["Business profile", "Contact information", "Service areas", "Basic analytics"]'::jsonb, 1),
('Featured Directory', 'Stand out with priority placement in search results and featured badge', 149.99, 30, 'featured', '["Everything in Basic", "Featured badge", "Priority placement", "Premium analytics", "Up to 5 service categories"]'::jsonb, 2),
('Sidebar Ads', 'Display banner ads in listing detail page sidebars with targeted location options', 299.99, 30, 'sidebar', '["Custom banner design", "50,000 impressions/month", "Location targeting", "Click tracking", "Performance analytics"]'::jsonb, 3),
('Homepage Banner', 'Premium placement on homepage with maximum visibility to all visitors', 499.99, 30, 'banner', '["Homepage hero placement", "100,000 impressions/month", "Full analytics suite", "A/B testing support", "Priority support"]'::jsonb, 4);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_vendor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_vendor_profiles_updated_at
  BEFORE UPDATE ON public.vendor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vendor_updated_at();

CREATE TRIGGER update_vendor_subscriptions_updated_at
  BEFORE UPDATE ON public.vendor_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vendor_updated_at();

CREATE TRIGGER update_advertisements_updated_at
  BEFORE UPDATE ON public.advertisements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_vendor_updated_at();

-- Create indexes for performance
CREATE INDEX idx_vendor_profiles_user_id ON public.vendor_profiles(user_id);
CREATE INDEX idx_vendor_profiles_business_type ON public.vendor_profiles(business_type);
CREATE INDEX idx_vendor_subscriptions_vendor_id ON public.vendor_subscriptions(vendor_id);
CREATE INDEX idx_vendor_subscriptions_status ON public.vendor_subscriptions(status);
CREATE INDEX idx_advertisements_vendor_id ON public.advertisements(vendor_id);
CREATE INDEX idx_advertisements_ad_type ON public.advertisements(ad_type);
CREATE INDEX idx_advertisements_placement_zone ON public.advertisements(placement_zone);
CREATE INDEX idx_ad_impressions_ad_id ON public.ad_impressions(ad_id);
CREATE INDEX idx_ad_impressions_created_at ON public.ad_impressions(created_at);
CREATE INDEX idx_ad_clicks_ad_id ON public.ad_clicks(ad_id);
CREATE INDEX idx_ad_clicks_created_at ON public.ad_clicks(created_at);