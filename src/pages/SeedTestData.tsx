import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";

const SeedTestData = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleSeed = async () => {
    setLoading(true);
    setResults(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('seed-test-agents');
      
      if (error) throw error;
      
      setResults(data);
      toast.success(data.message || "Test agents created successfully!");
    } catch (error) {
      console.error("Error seeding data:", error);
      toast.error("Failed to seed test data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Seed Test Data</CardTitle>
            <CardDescription>
              Create 10 test agent profiles with coverage areas and listings for Massachusetts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">This will create:</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>10 agent profiles with full details</li>
                <li>Auth accounts for each agent (password: TestPassword123!)</li>
                <li>Massachusetts coverage areas (counties)</li>
                <li>2-3 active listings per agent</li>
              </ul>
            </div>

            <Button 
              onClick={handleSeed} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Creating Test Data..." : "Seed Test Agents"}
            </Button>

            {results && (
              <div className="mt-6 space-y-3">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="font-medium text-green-900 dark:text-green-100">
                    {results.message}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Results:</p>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {results.results?.map((result: any, index: number) => (
                      <div
                        key={index}
                        className={`p-3 rounded-md text-sm ${
                          result.success
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium">{result.email}</span>
                          {result.success ? (
                            <span className="text-green-600 dark:text-green-400">
                              ✓ {result.listingCount} listings
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">✗ Failed</span>
                          )}
                        </div>
                        {result.error && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {result.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SeedTestData;
