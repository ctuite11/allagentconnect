import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface AdBannerProps {
  placementZone: string;
  className?: string;
}

const AdBanner = ({ placementZone, className = "" }: AdBannerProps) => {
  const [ad, setAd] = useState<any>(null);
  const [impressionRecorded, setImpressionRecorded] = useState(false);

  useEffect(() => {
    fetchAd();
  }, [placementZone]);

  useEffect(() => {
    if (ad && !impressionRecorded) {
      recordImpression();
    }
  }, [ad]);

  const fetchAd = async () => {
    try {
      // Fetch active ads for this placement zone
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_active', true)
        .or(`placement_zone.eq.${placementZone},placement_zone.is.null`)
        .order('priority', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setAd(data);
    } catch (error) {
      console.error('Error fetching ad:', error);
    }
  };

  const recordImpression = async () => {
    if (!ad) return;

    try {
      await supabase
        .from('ad_impressions')
        .insert([{
          ad_id: ad.id,
          page_url: window.location.href,
        }]);
      
      setImpressionRecorded(true);
    } catch (error) {
      console.error('Error recording impression:', error);
    }
  };

  const handleClick = async () => {
    if (!ad) return;

    try {
      await supabase
        .from('ad_clicks')
        .insert([{
          ad_id: ad.id,
          page_url: window.location.href,
        }]);

      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error recording click:', error);
    }
  };

  if (!ad) return null;

  return (
    <Card 
      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${className}`}
      onClick={handleClick}
    >
      <div className="relative">
        {ad.image_url && (
          <img 
            src={ad.image_url} 
            alt={ad.title}
            className="w-full h-auto object-cover"
          />
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{ad.title}</h3>
              {ad.description && (
                <p className="text-sm text-muted-foreground">{ad.description}</p>
              )}
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Sponsored
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AdBanner;