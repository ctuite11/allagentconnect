import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormattedInput } from "@/components/ui/formatted-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const vendorFormSchema = z.object({
  company_name: z.string().min(2, "Company name must be at least 2 characters"),
  business_type: z.string().min(1, "Please select a business type"),
  contact_name: z.string().min(2, "Contact name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  description: z.string().min(20, "Description must be at least 20 characters").max(500),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

const businessTypes = [
  { value: "mortgage", label: "Mortgage Broker/Lender" },
  { value: "inspection", label: "Home Inspector" },
  { value: "title", label: "Title Company" },
  { value: "insurance", label: "Home Insurance" },
  { value: "contractor", label: "Contractor/Handyman" },
  { value: "moving", label: "Moving Company" },
  { value: "staging", label: "Home Staging" },
  { value: "photography", label: "Real Estate Photography" },
  { value: "attorney", label: "Real Estate Attorney" },
  { value: "other", label: "Other Service" },
];

const VendorSetup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      company_name: "",
      business_type: "",
      contact_name: "",
      email: "",
      phone: "",
      website: "",
      description: "",
    },
  });

  const onSubmit = async (values: VendorFormValues) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to create a vendor profile");
        navigate('/auth');
        return;
      }

      const { error } = await supabase
        .from('vendor_profiles')
        .insert({
          user_id: user.id,
          company_name: values.company_name,
          business_type: values.business_type,
          contact_name: values.contact_name,
          email: values.email,
          phone: values.phone || null,
          website: values.website || null,
          description: values.description,
        });

      if (error) throw error;

      toast.success("Vendor profile created! Pending approval.");
      navigate('/vendor/dashboard');
    } catch (error) {
      console.error('Error creating vendor profile:', error);
      toast.error("Failed to create vendor profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 pt-20 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Create Vendor Profile</CardTitle>
          <CardDescription>
            Set up your vendor profile to start advertising your services to real estate agents and buyers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC Title Company" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your business type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {businessTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contact@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <FormattedInput format="phone" placeholder="1234567890" value={field.value || ""} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input type="url" placeholder="https://www.yourcompany.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell us about your business, services, and what makes you unique..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This will be displayed in your vendor directory listing
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Profile
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorSetup;