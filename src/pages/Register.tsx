import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Logo } from "@/components/brand";
import NetworkGlobe from "@/components/home/NetworkGlobe";
import { InviteAgentDialog } from "@/components/InviteAgentDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "Washington D.C." },
];

const formSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().optional(),
  brokerage: z.string().min(1, "Brokerage is required").max(200),
  state: z.string().min(1, "State is required"),
  license_number: z.string().min(1, "License number is required").max(50),
});

type FormData = z.infer<typeof formSchema>;

const Register = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      brokerage: "",
      state: "",
      license_number: "",
    },
  });

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setValue("phone", formatted);
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const { data: response, error } = await supabase.functions.invoke(
        "submit-early-access",
        {
          body: {
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            phone: data.phone || undefined,
            brokerage: data.brokerage,
            state: data.state,
            license_number: data.license_number,
          },
        }
      );

      if (error) {
        console.error("Submission error:", error);
        toast.error("Something went wrong. Please try again.");
        return;
      }

      if (response.duplicate) {
        setIsDuplicate(true);
        setIsSuccess(true);
      } else if (response.success) {
        setIsSuccess(true);
      } else if (response.error) {
        toast.error(response.error);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedState = watch("state");

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-0 shadow-none">
        <div className="mx-auto max-w-6xl px-5 py-3 flex items-center">
          <Logo size="lg" />
        </div>
      </header>

      <main className="pt-16 pb-8 relative min-h-screen">
        {/* Background globe - only show on form, not success */}
        {!isSuccess && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
            <div className="absolute right-0 lg:right-6 top-0">
              <NetworkGlobe />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 max-w-[720px] mx-auto px-6 pt-4">
          {isSuccess ? (
            /* Premium Success State */
            <div className="relative">
              {/* Globe watermark behind card */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08]">
                <div className="w-[900px] h-[900px]">
                  <NetworkGlobe variant="static" />
                </div>
              </div>

              {/* Confirmation card */}
              <div className="relative z-10 mx-auto w-full max-w-[720px] rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.06)] px-10 py-10">
              {/* AAC Monogram */}
              <div className="flex justify-center">
                <Logo variant="icon" size="lg" />
              </div>

              {/* Pill */}
              <div className="mt-5 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 uppercase tracking-wide">
                  Early Access
                </span>
              </div>

              {/* Headline */}
              <h1 className="mt-4 text-center text-3xl font-semibold tracking-tight text-zinc-900">
                {isDuplicate ? "You're Already On The List" : "You're in."}
              </h1>

              {/* Body */}
              <p className="mt-2 text-center text-sm leading-relaxed text-zinc-600">
                {isDuplicate
                  ? "This email is already on our early access list. We'll be in touch soon."
                  : "Thanks — we've received your details and added you to the All Agent Connect early access list."}
              </p>

              {/* What to expect */}
              {!isDuplicate && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-zinc-900">What to expect</h3>
                  <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 flex-shrink-0" />
                      You'll receive launch updates as access opens.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 flex-shrink-0" />
                      Early access members receive priority status.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 flex-shrink-0" />
                      Early access members receive preferred pricing.
                    </li>
                  </ul>
                </div>
              )}

              {/* CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  className="h-11 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 transition-colors"
                  onClick={() => window.location.href = '/'}
                >
                  Back to Home
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-3 h-11 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-950 transition-colors"
                  onClick={() => setShowInviteDialog(true)}
                >
                  Invite an Agent
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <ArrowRight className="w-4 h-4 text-white" />
                  </span>
                </button>
              </div>
            </div>
            </div>
          ) : (
            /* Form */
            <>
              {/* Page framing */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0E56F5]" />
                  <span className="text-xs font-medium tracking-wide text-zinc-600 uppercase">
                    Early Access
                  </span>
                </div>

                <h1 className="text-3xl font-semibold text-zinc-900 mb-6">
                  Request Early Access to All Agent Connect
                </h1>

                {/* Capability pills */}
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {["Off-market", "Coming soon", "Agent-to-agent"].map(
                    (pill) => (
                      <span
                        key={pill}
                        className="px-3 py-1 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-full"
                      >
                        {pill}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Form card */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Name row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="first_name" className="text-zinc-700">
                        First Name
                      </Label>
                      <Input
                        id="first_name"
                        {...register("first_name")}
                        className="h-11 rounded-[10px]"
                        placeholder="Jane"
                      />
                      {errors.first_name && (
                        <p className="text-xs text-red-500">
                          {errors.first_name.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="last_name" className="text-zinc-700">
                        Last Name
                      </Label>
                      <Input
                        id="last_name"
                        {...register("last_name")}
                        className="h-11 rounded-[10px]"
                        placeholder="Smith"
                      />
                      {errors.last_name && (
                        <p className="text-xs text-red-500">
                          {errors.last_name.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Brokerage */}
                  <div className="space-y-1.5">
                    <Label htmlFor="brokerage" className="text-zinc-700">
                      Brokerage
                    </Label>
                    <Input
                      id="brokerage"
                      {...register("brokerage")}
                      className="h-11 rounded-[10px]"
                      placeholder="Your brokerage name"
                    />
                    {errors.brokerage && (
                      <p className="text-xs text-red-500">
                        {errors.brokerage.message}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-zinc-700">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      className="h-11 rounded-[10px]"
                      placeholder="jane@brokerage.com"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Phone (optional) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-zinc-700">
                      Phone{" "}
                      <span className="text-zinc-400 font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      {...register("phone")}
                      onChange={handlePhoneChange}
                      className="h-11 rounded-[10px]"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  {/* State + License row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="state" className="text-zinc-700">
                        License State
                      </Label>
                      <Select
                        value={selectedState}
                        onValueChange={(val) => setValue("state", val)}
                      >
                        <SelectTrigger className="h-11 rounded-[10px]">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((st) => (
                            <SelectItem key={st.value} value={st.value}>
                              {st.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.state && (
                        <p className="text-xs text-red-500">
                          {errors.state.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="license_number" className="text-zinc-700">
                        License #
                      </Label>
                      <Input
                        id="license_number"
                        {...register("license_number")}
                        className="h-11 rounded-[10px]"
                        placeholder="12345678"
                      />
                      {errors.license_number && (
                        <p className="text-xs text-red-500">
                          {errors.license_number.message}
                        </p>
                      )}
                    </div>
                  </div>


                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center gap-3 h-12 bg-zinc-900 text-white text-[15px] font-semibold rounded-xl mt-2 shadow-[0_1px_2px_rgba(0,0,0,0.10)] hover:bg-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? "Submitting..." : "Request Early Access"}
                    {!isSubmitting && (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <ArrowRight className="w-4 h-4 text-white" />
                      </span>
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Invite Agent Dialog */}
      <InviteAgentDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </div>
  );
};

export default Register;
