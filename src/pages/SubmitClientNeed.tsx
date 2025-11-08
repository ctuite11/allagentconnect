import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import { z } from "zod";
import { US_STATES } from "@/data/usStatesCountiesData";

const clientNeedSchema = z.object({
  propertyType: z.enum(["single_family", "condo", "townhouse", "multi_family", "land", "commercial", "residential_rental", "commercial_rental"], {
    errorMap: () => ({ message: "Please select a valid property type" }),
  }),
  city: z.string().trim().min(1, "City is required").max(100, "City must be less than 100 characters"),
  state: z.string().trim().length(2, "State must be 2 characters"),
  maxPrice: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid number")
    .refine((val) => parseFloat(val) > 0 && parseFloat(val) < 100000000, {
      message: "Price must be between $1 and $100,000,000",
    }),
  bedrooms: z.string()
    .regex(/^\d*$/, "Bedrooms must be a whole number")
    .optional()
    .or(z.literal("")),
  bathrooms: z.string()
    .regex(/^\d*(\.\d{1})?$/, "Bathrooms must be a number (e.g., 2.5)")
    .optional()
    .or(z.literal("")),
  description: z.string()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
});

const SubmitClientNeed = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    propertyType: "",
    city: "",
    state: "",
    maxPrice: "",
    bedrooms: "",
    bathrooms: "",
    description: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validatedData = clientNeedSchema.parse(formData);

      const { error: insertError } = await supabase.from("client_needs").insert({
        submitted_by: user?.id,
        property_type: validatedData.propertyType as any,
        city: validatedData.city,
        state: validatedData.state,
        max_price: parseFloat(validatedData.maxPrice),
        bedrooms: validatedData.bedrooms ? parseInt(validatedData.bedrooms) : null,
        bathrooms: validatedData.bathrooms ? parseFloat(validatedData.bathrooms) : null,
        description: validatedData.description || null,
      } as any);

      if (insertError) throw insertError;

      toast.success("Client need submitted successfully!");

      navigate("/agent-dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Error submitting client need: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Submit Client Need</CardTitle>
            <CardDescription>
              Fill out the details for your client's real estate needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="propertyType">Property Type</Label>
                <Select
                  value={formData.propertyType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, propertyType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_family">Single Family</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="multi_family">Multi-Family</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="residential_rental">Residential Rental</SelectItem>
                    <SelectItem value="commercial_rental">Commercial Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="Boston"
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) =>
                      setFormData({ ...formData, state: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="z-50 max-h-[300px]">
                      {US_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.code} - {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="maxPrice">Maximum Price ($)</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  required
                  value={formData.maxPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, maxPrice: e.target.value })
                  }
                  placeholder="5000000"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    value={formData.bedrooms}
                    onChange={(e) =>
                      setFormData({ ...formData, bedrooms: e.target.value })
                    }
                    placeholder="3"
                  />
                </div>
                <div>
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    step="0.5"
                    value={formData.bathrooms}
                    onChange={(e) =>
                      setFormData({ ...formData, bathrooms: e.target.value })
                    }
                    placeholder="2.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Additional details about the client's needs..."
                  rows={4}
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Client Need"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/agent-dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubmitClientNeed;
