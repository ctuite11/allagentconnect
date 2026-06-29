import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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
import { Seo } from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TurnstileField } from "@/components/security/TurnstileField";
import { useTurnstile } from "@/hooks/useTurnstile";

const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
  ["DC","Washington D.C."],
] as const;

const formSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().min(1, "Phone is required").max(40),
  brokerage: z.string().trim().min(1, "Brokerage is required").max(200),
  state: z.string().min(1, "License state is required"),
  license_number: z.string().trim().min(1, "License number is required").max(50),
});

type FormData = z.infer<typeof formSchema>;

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

const RequestAccess = () => {
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source");
  const turnstile = useTurnstile("agent_early_access");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

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

  useEffect(() => {
    if (source && typeof window !== "undefined") {
      (window as any).gtag?.("event", "request_access_view", { source });
    }
  }, [source]);

  const onSubmit = async (data: FormData) => {
    const turnstileToken = turnstile.requireToken();
    if (!turnstileToken) return;

    setIsSubmitting(true);
    let succeeded = false;
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
            turnstile_token: turnstileToken,
            source: source || undefined,
          },
        }
      );

      if (error) {
        console.error("Request Access submission error:", error);
        toast.error("Something went wrong. Please try again.");
        return;
      }

      if (response?.duplicate) {
        setIsDuplicate(true);
        setIsSuccess(true);
        succeeded = true;
      } else if (response?.success) {
        setIsSuccess(true);
        succeeded = true;
      } else if (response?.error) {
        toast.error(response.error);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      if (!succeeded) turnstile.reset();
      setIsSubmitting(false);
    }
  };

  const selectedState = watch("state");

  return (
    <>
      <Seo
        title="Request Access | All Agent Connect"
        description="Request access to the private agent network for off-market and coming-soon listings."
        canonical="https://allagentconnect.com/request-access"
      />
      <div className="min-h-screen bg-white">
        <header className="border-b border-neutral-100">
          <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
            <Link to="/" aria-label="All Agent Connect home">
              <Logo size="lg" />
            </Link>
            <Link
              to="/auth"
              className="font-['Manrope'] text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-[640px] px-6 pt-10 pb-20">
          {isSuccess ? (
            <div className="text-center pt-8">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h1 className="font-['Manrope'] text-3xl font-semibold tracking-tight text-neutral-900 mb-3">
                {isDuplicate ? "You're already on the list" : "You're on the list"}
              </h1>
              <p className="font-['Manrope'] text-base text-neutral-600 max-w-md mx-auto mb-8">
                {isDuplicate
                  ? "This email is already registered. We'll be in touch as access opens."
                  : "Your request has been received. We review every applicant and will email you once your access is verified."}
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-['Manrope'] font-semibold text-sm transition-colors"
              >
                Back to home
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#50C878]" />
                  <span className="font-['Manrope'] text-xs font-medium tracking-wider text-neutral-600 uppercase">
                    Verified Agent Network
                  </span>
                </div>
                <h1 className="font-['Manrope'] text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900 leading-tight mb-3">
                  Request access to All Agent Connect
                </h1>
                <p className="font-['Manrope'] text-base text-neutral-600 leading-relaxed">
                  A private network for licensed agents to share off-market and coming-soon listings, surface buyer demand, and collaborate before deals hit the public market.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name" className="text-[13px] font-medium text-neutral-700">First name</Label>
                    <Input
                      id="first_name"
                      {...register("first_name")}
                      autoComplete="given-name"
                      className="mt-1.5 h-11 rounded-[10px] border-zinc-200 bg-white focus-visible:border-[#0E56F5] focus-visible:ring-2 focus-visible:ring-[#0E56F5]/20"
                    />
                    {errors.first_name && <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="last_name" className="text-[13px] font-medium text-neutral-700">Last name</Label>
                    <Input
                      id="last_name"
                      {...register("last_name")}
                      autoComplete="family-name"
                      className="mt-1.5 h-11 rounded-[10px] border-zinc-200 bg-white focus-visible:border-[#0E56F5] focus-visible:ring-2 focus-visible:ring-[#0E56F5]/20"
                    />
                    {errors.last_name && <p className="mt-1 text-xs text-red-500">{errors.last_name.message}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="email" className="text-[13px] font-medium text-neutral-700">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    autoComplete="email"
                    placeholder="you@brokerage.com"
                    className="mt-1.5 h-11 rounded-[10px] border-zinc-200 bg-white focus-visible:border-[#0E56F5] focus-visible:ring-2 focus-visible:ring-[#0E56F5]/20"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                </div>

                <div>
                  <Label htmlFor="phone" className="text-[13px] font-medium text-neutral-700">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(555) 123-4567"
                    value={watch("phone") || ""}
                    onChange={(e) => setValue("phone", formatPhoneNumber(e.target.value), { shouldValidate: true })}
                    className="mt-1.5 h-11 rounded-[10px] border-zinc-200 bg-white focus-visible:border-[#0E56F5] focus-visible:ring-2 focus-visible:ring-[#0E56F5]/20"
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                </div>

                <div>
                  <Label htmlFor="brokerage" className="text-[13px] font-medium text-neutral-700">Brokerage</Label>
                  <Input
                    id="brokerage"
                    {...register("brokerage")}
                    autoComplete="organization"
                    className="mt-1.5 h-11 rounded-[10px] border-zinc-200 bg-white focus-visible:border-[#0E56F5] focus-visible:ring-2 focus-visible:ring-[#0E56F5]/20"
                  />
                  {errors.brokerage && <p className="mt-1 text-xs text-red-500">{errors.brokerage.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="state" className="text-[13px] font-medium text-neutral-700">License state</Label>
                    <Select value={selectedState} onValueChange={(v) => setValue("state", v, { shouldValidate: true })}>
                      <SelectTrigger
                        id="state"
                        className="mt-1.5 h-11 rounded-[10px] border-zinc-200 bg-white focus:ring-2 focus:ring-[#0E56F5]/20"
                      >
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.state && <p className="mt-1 text-xs text-red-500">{errors.state.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="license_number" className="text-[13px] font-medium text-neutral-700">License number</Label>
                    <Input
                      id="license_number"
                      {...register("license_number")}
                      className="mt-1.5 h-11 rounded-[10px] border-zinc-200 bg-white focus-visible:border-[#0E56F5] focus-visible:ring-2 focus-visible:ring-[#0E56F5]/20"
                    />
                    {errors.license_number && <p className="mt-1 text-xs text-red-500">{errors.license_number.message}</p>}
                  </div>
                </div>

                <TurnstileField containerRef={turnstile.containerRef} error={turnstile.error} className="pt-1" />

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-full bg-[#50C878] hover:bg-[#45b96d] text-black font-['Manrope'] font-semibold text-base shadow-sm disabled:opacity-60"
                >
                  {isSubmitting ? "Submitting…" : "Request access"}
                </Button>

                <p className="text-center text-xs text-neutral-500 pt-1">
                  Already approved? <Link to="/auth" className="text-[#0E56F5] hover:underline">Sign in</Link>
                </p>
              </form>
            </>
          )}
        </main>
      </div>
    </>
  );
};

export default RequestAccess;