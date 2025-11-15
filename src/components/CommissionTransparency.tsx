import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingDown, Info } from "lucide-react";

const CommissionTransparency = () => {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Understanding Real Estate Commissions
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Knowledge is power. Understanding how commissions work can save you thousands on your next home purchase.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Traditional Commission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Typically, home sales involve a 5-6% commission split between listing and buyer agents.
                </p>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm font-semibold">Example on $500,000 home:</p>
                  <p className="text-2xl font-bold text-primary">$25,000 - $30,000</p>
                  <p className="text-xs text-muted-foreground">Total commission paid</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-primary">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mb-4">
                  <TrendingDown className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>Direct Connection Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  By working directly with the listing agent, you can potentially save the buyer agent commission.
                </p>
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-200">Potential Savings:</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">$12,500 - $15,000</p>
                  <p className="text-xs text-green-700 dark:text-green-300">On same $500,000 home</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Buyer Agent Option</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Prefer representation? We connect you with verified buyer agents who can guide your purchase.
                </p>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Your Choice:</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">Full representation</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">When you need guidance</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Variable Rate Commission Explanation */}
          <Card className="bg-secondary/30 border-2">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <Info className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl mb-2">Variable Rate Commission</CardTitle>
                  <p className="text-muted-foreground">
                    A flexible commission structure that benefits both buyers and sellers
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-primary" />
                    Buyer Advantage
                  </h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Clearly identify the listing agent for every property</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Option to work directly with listing agent for savings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Choice to hire a verified buyer agent when needed</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Seller Advantage
                  </h4>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Lower commission when representing both parties</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Standard commission when buyer brings their own agent</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Transparency in all commission structures</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default CommissionTransparency;
