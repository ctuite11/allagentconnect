import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle, Users, Shield, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

const SPECIALTIES = [
  { id: "sales", label: "Sales" },
  { id: "rentals", label: "Rentals" },
  { id: "commercial", label: "Commercial" },
];

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  brokerage: z.string().min(1, "Brokerage / Company is required"),
  state: z.string().min(1, "State is required"),
  licenseNumber: z.string().min(1, "License number is required"),
  markets: z.string().optional(),
  specialties: z.array(z.string()).optional(),
});

type FormData = z.infer<typeof formSchema>;

const EarlyAccess: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      brokerage: "",
      state: "",
      licenseNumber: "",
      markets: "",
      specialties: [],
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      // Insert into database
      const { error: insertError } = await supabase
        .from("agent_early_access")
        .insert({
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          brokerage: data.brokerage,
          state: data.state,
          license_number: data.licenseNumber,
          markets: data.markets || null,
          specialties: data.specialties?.length ? data.specialties : null,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          toast.error("This email is already registered for early access.");
        } else {
          console.error("Insert error:", insertError);
          toast.error("Something went wrong. Please try again.");
        }
        setIsSubmitting(false);
        return;
      }

      // Send confirmation email
      try {
        await supabase.functions.invoke("send-early-access-registration", {
          body: {
            email: data.email.toLowerCase(),
            firstName: data.firstName,
          },
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
        // Don't block submission if email fails
      }

      setSubmitted(true);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <Helmet>
          <title>Registration Received — All Agent Connect</title>
        </Helmet>
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-4">
              Registration received
            </h1>
            <p className="text-muted-foreground mb-6">
              We verify agents manually. You'll receive an email when you're approved.
            </p>
            <p className="text-sm text-muted-foreground">
              Check your inbox for a confirmation email.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Early Access — All Agent Connect</title>
        <meta
          name="description"
          content="Register for early access to All Agent Connect. Be among the first 250 verified agents to receive Founding Partner status."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="bg-gradient-to-b from-primary/5 to-background pt-16 pb-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4">
              Early Access Registration
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Join the network before launch. The first 250 verified agents
              receive Founding Partner status — free access to the platform.
            </p>

            {/* Value Props */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-xl mx-auto">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Agents only</p>
                  <p className="text-xs text-muted-foreground">Licensed & verified</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">First 250</p>
                  <p className="text-xs text-muted-foreground">Founding Partner</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Launch day</p>
                  <p className="text-xs text-muted-foreground">Immediate access</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="max-w-lg mx-auto px-4 pb-16">
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Name Row */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Smith" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="jane@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Phone */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile (optional but recommended)</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="(555) 123-4567"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Brokerage */}
                <FormField
                  control={form.control}
                  name="brokerage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brokerage / Company *</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC Realty" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* State & License */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
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
                    name="licenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License # *</FormLabel>
                        <FormControl>
                          <Input placeholder="12345678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Markets */}
                <FormField
                  control={form.control}
                  name="markets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary markets (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Boston, Cambridge, Somerville"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Specialties */}
                <FormField
                  control={form.control}
                  name="specialties"
                  render={() => (
                    <FormItem>
                      <FormLabel>Specialties (optional)</FormLabel>
                      <div className="flex gap-6 mt-2">
                        {SPECIALTIES.map((specialty) => (
                          <FormField
                            key={specialty.id}
                            control={form.control}
                            name="specialties"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(specialty.id)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      if (checked) {
                                        field.onChange([...current, specialty.id]);
                                      } else {
                                        field.onChange(
                                          current.filter((v) => v !== specialty.id)
                                        );
                                      }
                                    }}
                                  />
                                </FormControl>
                                <Label className="text-sm font-normal cursor-pointer">
                                  {specialty.label}
                                </Label>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full mt-6"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Register for Early Access"}
                </Button>
              </form>
            </Form>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            By registering, you confirm you are a licensed real estate agent.
            We verify all licenses manually.
          </p>
        </div>
      </div>
    </>
  );
};

export default EarlyAccess;
