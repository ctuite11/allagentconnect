import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Bed, Bath, Square } from "lucide-react";

interface PropertyCardProps {
  image: string;
  title: string;
  price: string;
  savings: string;
  address: string;
  beds: number;
  baths: number;
  sqft: string;
}

const PropertyCard = ({ image, title, price, savings, address, beds, baths, sqft }: PropertyCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-custom-hover transition-all duration-300 group">
      <div className="relative overflow-hidden">
        <img 
          src={image} 
          alt={title}
          className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <Badge className="absolute top-4 right-4 bg-success text-success-foreground">
          Save {savings}
        </Badge>
      </div>
      
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-2xl font-bold text-primary">{price}</h3>
        </div>
        
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <MapPin className="w-4 h-4" />
          <p className="text-sm">{address}</p>
        </div>
        
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Bed className="w-4 h-4" />
            <span>{beds} beds</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="w-4 h-4" />
            <span>{baths} baths</span>
          </div>
          <div className="flex items-center gap-1">
            <Square className="w-4 h-4" />
            <span>{sqft} sqft</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PropertyCard;
