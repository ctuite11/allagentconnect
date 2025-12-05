import { Gift, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface IncentivesSectionProps {
  buyerIncentives: string;
  sellerIncentives: string;
  onBuyerChange: (value: string) => void;
  onSellerChange: (value: string) => void;
}

const IncentivesSection = ({
  buyerIncentives,
  sellerIncentives,
  onBuyerChange,
  onSellerChange,
}: IncentivesSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Buyer Incentives */}
      <Card className="border-2 hover:border-accent/50 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base">
            <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Gift className="h-5 w-5 text-accent" />
            </div>
            Buyer Incentives
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g., Free home inspection, closing cost assistance, buyer rebate..."
            value={buyerIncentives}
            onChange={(e) => onBuyerChange(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Seller Incentives */}
      <Card className="border-2 hover:border-primary/50 transition-colors">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            Seller Incentives
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g., Professional photography, staging consultation, reduced commission..."
            value={sellerIncentives}
            onChange={(e) => onSellerChange(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default IncentivesSection;
