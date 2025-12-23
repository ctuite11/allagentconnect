import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Home, Users, BarChart3, MapPin, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface MarketInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    address: string;
    city: string;
    state: string;
    zip_code: string;
    price: number;
    property_type: string | null;
  };
}

const MarketInsightsDialog = ({ open, onOpenChange, listing }: MarketInsightsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [marketData, setMarketData] = useState<any>(null);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fetch-attom-market-data', {
        body: {
          address: listing.address,
          zipCode: listing.zip_code,
          city: listing.city,
          state: listing.state,
        },
      });

      if (error) throw error;
      setMarketData(data);
    } catch (error) {
      console.error('Error fetching market data:', error);
      toast.error('Failed to load market insights');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen && !marketData) {
      fetchMarketData();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const exportToPDF = () => {
    if (!marketData) {
      toast.error('No market data to export');
      return;
    }

    try {
      const pdf = new jsPDF();
      let yPosition = 20;
      const lineHeight = 7;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;

      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Market Insights Report', margin, yPosition);
      yPosition += lineHeight * 2;

      // Property Information
      pdf.setFontSize(14);
      pdf.text('Property Information', margin, yPosition);
      yPosition += lineHeight;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Address: ${listing.address}`, margin, yPosition);
      yPosition += lineHeight;
      pdf.text(`City: ${listing.city}, ${listing.state} ${listing.zip_code}`, margin, yPosition);
      yPosition += lineHeight;
      pdf.text(`List Price: ${formatCurrency(listing.price)}`, margin, yPosition);
      yPosition += lineHeight;
      pdf.text(`Property Type: ${listing.property_type || 'N/A'}`, margin, yPosition);
      yPosition += lineHeight * 2;

      // AVM Data
      if (marketData.avm?.property?.[0]?.avm) {
        const avm = marketData.avm.property[0].avm;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Automated Valuation', margin, yPosition);
        yPosition += lineHeight;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Estimated Value: ${formatCurrency(avm.amount.value)}`, margin, yPosition);
        yPosition += lineHeight;
        pdf.text(`Value Range: ${formatCurrency(avm.amount.valueLow)} - ${formatCurrency(avm.amount.valueHigh)}`, margin, yPosition);
        yPosition += lineHeight;
        pdf.text(`Confidence Score: ${avm.fsd || 'N/A'}`, margin, yPosition);
        yPosition += lineHeight;
        const priceDiff = ((listing.price - avm.amount.value) / avm.amount.value) * 100;
        pdf.text(`List Price vs AVM: ${formatPercent(priceDiff)}`, margin, yPosition);
        yPosition += lineHeight * 2;
      }

      // Sales Trends
      if (marketData.salesTrends?.result) {
        const trends = marketData.salesTrends.result;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Sales Trends - ${listing.zip_code}`, margin, yPosition);
        yPosition += lineHeight;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        if (trends.medianSalePrice) {
          pdf.text(`Median Sale Price: ${formatCurrency(trends.medianSalePrice)}`, margin, yPosition);
          yPosition += lineHeight;
        }
        if (trends.averageSalePrice) {
          pdf.text(`Average Sale Price: ${formatCurrency(trends.averageSalePrice)}`, margin, yPosition);
          yPosition += lineHeight;
        }
        if (trends.avgDaysOnMarket) {
          pdf.text(`Average Days on Market: ${Math.round(trends.avgDaysOnMarket)} days`, margin, yPosition);
          yPosition += lineHeight;
        }
        if (trends.numberOfSales) {
          pdf.text(`Number of Sales: ${trends.numberOfSales}`, margin, yPosition);
          yPosition += lineHeight * 2;
        }
      }

      // Check if we need a new page
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }

      // Demographics
      if (marketData.demographics?.demographics) {
        const demo = marketData.demographics.demographics;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Area Demographics', margin, yPosition);
        yPosition += lineHeight;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        if (demo.population) {
          pdf.text(`Population: ${demo.population.toLocaleString()}`, margin, yPosition);
          yPosition += lineHeight;
        }
        if (demo.medianHouseholdIncome) {
          pdf.text(`Median Household Income: ${formatCurrency(demo.medianHouseholdIncome)}`, margin, yPosition);
          yPosition += lineHeight;
        }
        if (demo.medianHomeValue) {
          pdf.text(`Median Home Value: ${formatCurrency(demo.medianHomeValue)}`, margin, yPosition);
          yPosition += lineHeight;
        }
        if (demo.ownerOccupiedPercent) {
          pdf.text(`Owner Occupied: ${demo.ownerOccupiedPercent}%`, margin, yPosition);
          yPosition += lineHeight * 2;
        }
      }

      // Recent Comparable Sales
      if (marketData.comparables?.property?.length > 0) {
        if (yPosition > 200) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Recent Comparable Sales', margin, yPosition);
        yPosition += lineHeight;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        
        marketData.comparables.property.slice(0, 5).forEach((comp: any, idx: number) => {
          if (yPosition > 270) {
            pdf.addPage();
            yPosition = 20;
          }
          const address = comp.address?.oneLine || 'Address unavailable';
          const date = comp.sale?.saleTransDate ? new Date(comp.sale.saleTransDate).toLocaleDateString() : 'Date N/A';
          const price = comp.sale?.amount?.saleAmt ? formatCurrency(comp.sale.amount.saleAmt) : 'N/A';
          pdf.text(`${idx + 1}. ${address}`, margin, yPosition);
          yPosition += lineHeight - 1;
          pdf.text(`   Sale Date: ${date} | Price: ${price}`, margin, yPosition);
          yPosition += lineHeight;
        });
      }

      // Footer
      const pageCount = pdf.getNumberOfPages();
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.text(
          `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
          margin,
          pdf.internal.pageSize.getHeight() - 10
        );
        pdf.text('Data provided by ATTOM Data Solutions', pageWidth - margin - 60, pdf.internal.pageSize.getHeight() - 10);
      }

      // Save the PDF
      const fileName = `Market_Insights_${listing.address.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      toast.success('PDF report downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Market Insights
          </DialogTitle>
          <DialogDescription>
            Comprehensive market data for {listing.address}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : marketData ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="valuation">Valuation</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="area">Area Stats</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Property Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-2 mb-4">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                    <div>
                      <div className="font-medium">{listing.address}</div>
                      <div className="text-sm text-muted-foreground">
                        {listing.city}, {listing.state} {listing.zip_code}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">List Price</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(listing.price)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Property Type</div>
                      <Badge variant="outline" className="mt-1">
                        {listing.property_type || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {marketData.comparables && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Sales in Area</CardTitle>
                    <CardDescription>Within 1 mile radius</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {marketData.comparables.property?.length > 0 ? (
                      <div className="space-y-3">
                        {marketData.comparables.property.slice(0, 5).map((comp: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {comp.address?.oneLine || 'Address unavailable'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {comp.sale?.saleTransDate ? new Date(comp.sale.saleTransDate).toLocaleDateString() : 'Date N/A'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">
                                {comp.sale?.amount?.saleAmt ? formatCurrency(comp.sale.amount.saleAmt) : 'N/A'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent sales data available</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Valuation Tab */}
            <TabsContent value="valuation" className="space-y-4">
              {marketData.avm && marketData.avm.property?.[0]?.avm ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Automated Valuation</CardTitle>
                      <CardDescription>ATTOM Data Solutions AVM</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Estimated Value</div>
                          <div className="text-2xl font-bold text-primary">
                            {formatCurrency(marketData.avm.property[0].avm.amount.value)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Low Range</div>
                          <div className="text-xl font-semibold">
                            {formatCurrency(marketData.avm.property[0].avm.amount.valueLow)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">High Range</div>
                          <div className="text-xl font-semibold">
                            {formatCurrency(marketData.avm.property[0].avm.amount.valueHigh)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Confidence Score</span>
                          <Badge variant="secondary">
                            {marketData.avm.property[0].avm.fsd || 'N/A'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Price Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <span className="text-sm">List Price vs. AVM</span>
                          <div className="flex items-center gap-2">
                            {listing.price > marketData.avm.property[0].avm.amount.value ? (
                              <>
                                <TrendingUp className="w-4 h-4 text-orange-500" />
                                <span className="font-semibold text-orange-500">
                                  {formatPercent(((listing.price - marketData.avm.property[0].avm.amount.value) / marketData.avm.property[0].avm.amount.value) * 100)}
                                </span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-4 h-4 text-emerald-500" />
                                <span className="font-semibold text-emerald-500">
                                  {formatPercent(((listing.price - marketData.avm.property[0].avm.amount.value) / marketData.avm.property[0].avm.amount.value) * 100)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">AVM data not available for this property</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Trends Tab */}
            <TabsContent value="trends" className="space-y-4">
              {marketData.salesTrends && marketData.salesTrends.result ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Sales Trends - {listing.zip_code}</CardTitle>
                    <CardDescription>Market trends for this zip code</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {marketData.salesTrends.result.medianSalePrice && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Median Sale Price</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {formatCurrency(marketData.salesTrends.result.medianSalePrice)}
                          </div>
                        </div>
                      )}
                      {marketData.salesTrends.result.avgDaysOnMarket && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Avg Days on Market</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {Math.round(marketData.salesTrends.result.avgDaysOnMarket)} days
                          </div>
                        </div>
                      )}
                      {marketData.salesTrends.result.numberOfSales && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Home className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Number of Sales</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {marketData.salesTrends.result.numberOfSales}
                          </div>
                        </div>
                      )}
                      {marketData.salesTrends.result.averageSalePrice && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Average Sale Price</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {formatCurrency(marketData.salesTrends.result.averageSalePrice)}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Sales trends data not available</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Area Stats Tab */}
            <TabsContent value="area" className="space-y-4">
              {marketData.demographics && marketData.demographics.demographics ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Area Demographics</CardTitle>
                    <CardDescription>Population and housing statistics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {marketData.demographics.demographics.population && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Population</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {marketData.demographics.demographics.population.toLocaleString()}
                          </div>
                        </div>
                      )}
                      {marketData.demographics.demographics.medianHouseholdIncome && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Median Income</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {formatCurrency(marketData.demographics.demographics.medianHouseholdIncome)}
                          </div>
                        </div>
                      )}
                      {marketData.demographics.demographics.medianHomeValue && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Home className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Median Home Value</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {formatCurrency(marketData.demographics.demographics.medianHomeValue)}
                          </div>
                        </div>
                      )}
                      {marketData.demographics.demographics.ownerOccupiedPercent && (
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Home className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Owner Occupied</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {marketData.demographics.demographics.ownerOccupiedPercent}%
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Demographics data not available</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            Click to load market insights data
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={exportToPDF}
            disabled={!marketData || loading}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MarketInsightsDialog;
