import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Seo } from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitDeveloperAccessRequest,
  validateDeveloperAccessForm,
} from "@/lib/developments/developerAccessRequest";

const CAPABILITIES = [
  "Development and project information for the agent mini-site",
  "Photos and media galleries",
  "Floor plans and plan types",
  "Units, pricing, and availability status",
  "Private agent documents (brochures, disclosures, compensation)",
  "Project updates and construction news",
  "Team access inside a dedicated Developer portal",
] as const;

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  website: string;
  project_name: string;
  market: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company_name: "",
  website: "",
  project_name: "",
  market: "",
  note: "",
};

/**
 * Public Developer product page + access request form.
 * Submits to submit-developer-access-request (no self-serve account creation).
 */
export default function DeveloperAccessPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [banner, setBanner] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    const clientErrors = validateDeveloperAccessForm(form);
    if (clientErrors.length > 0) {
      setFieldErrors(clientErrors);
      return;
    }
    setFieldErrors([]);
    setSubmitting(true);

    const outcome = await submitDeveloperAccessRequest({
      ...form,
      source: "developer-access",
    });
    setSubmitting(false);

    switch (outcome.kind) {
      case "success":
        setSubmitted(true);
        return;
      case "duplicate":
        setBanner({ tone: "info", text: outcome.message });
        return;
      case "validation":
        setFieldErrors(outcome.messages);
        return;
      case "rate_limited":
        setBanner({
          tone: "error",
          text: "Too many requests. Please wait a bit and try again.",
        });
        return;
      default:
        setBanner({
          tone: "error",
          text: "We couldn't submit your request. Please try again.",
        });
    }
  };

  return (
    <>
      <Seo
        title="Developer Access | All Agent Connect"
        description="Publish and manage new developments for AAC’s agent network in a dedicated Developer portal."
        canonical="https://allagentconnect.com/developer-access"
      />
      <AuthShell maxWidth="640px">
        <div className="space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              For real estate developers
            </p>
            <h1
              className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px]"
              style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
            >
              Present your developments to AAC’s agent network
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base">
              All Agent Connect gives development teams a dedicated portal to build agent-ready
              project pages—then submit them for AAC review and publishing so verified agents can
              browse inventory, documents, and updates in one place.
            </p>
          </div>

          <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 sm:p-6">
            <h2
              className="text-base font-semibold text-zinc-900"
              style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
            >
              What you can manage
            </h2>
            <ul className="mt-3 space-y-2.5">
              {CAPABILITIES.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-zinc-700">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16A34A]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2
              className="text-base font-semibold text-zinc-900"
              style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
            >
              How publishing works
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600">
              Your team drafts the project in the Developer portal, submits it for review, and AAC
              admins approve, publish, pause, or return it. Agents only see developments that AAC
              has published for the network—keeping quality high and messaging consistent.
            </p>
            <p className="text-sm leading-relaxed text-zinc-600">
              Request access below. AAC reviews each submission and, if approved, emails instructions
              to reach the Developer portal.
            </p>
          </section>

          {submitted ? (
            <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <h2
                className="text-lg font-semibold text-zinc-900"
                style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
              >
                Request received
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600">
                AAC will review your Developer access request. If approved, we’ll send you
                instructions to access the Developer portal.
              </p>
              <Link
                to="/request-access"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
              >
                Back to choices
              </Link>
            </section>
          ) : (
            <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <h2
                className="text-base font-semibold text-zinc-900"
                style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
              >
                Request Developer access
              </h2>

              {banner ? (
                <p
                  className={
                    banner.tone === "info"
                      ? "rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                      : "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  }
                  role="status"
                >
                  {banner.text}
                </p>
              ) : null}

              {fieldErrors.length > 0 ? (
                <ul className="list-disc space-y-1 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
                  {fieldErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              ) : null}

              <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="dev-first-name">First name</Label>
                  <Input
                    id="dev-first-name"
                    value={form.first_name}
                    onChange={setField("first_name")}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dev-last-name">Last name</Label>
                  <Input
                    id="dev-last-name"
                    value={form.last_name}
                    onChange={setField("last_name")}
                    autoComplete="family-name"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="dev-email">Work email</Label>
                  <Input
                    id="dev-email"
                    type="email"
                    value={form.email}
                    onChange={setField("email")}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="dev-phone">Phone</Label>
                  <Input
                    id="dev-phone"
                    type="tel"
                    value={form.phone}
                    onChange={setField("phone")}
                    autoComplete="tel"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="dev-company">Developer / Company name</Label>
                  <Input
                    id="dev-company"
                    value={form.company_name}
                    onChange={setField("company_name")}
                    autoComplete="organization"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="dev-website">
                    Website <span className="font-normal text-zinc-400">(optional)</span>
                  </Label>
                  <Input
                    id="dev-website"
                    type="url"
                    value={form.website}
                    onChange={setField("website")}
                    placeholder="https://"
                    autoComplete="url"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="dev-project">
                    Project / Development name{" "}
                    <span className="font-normal text-zinc-400">(optional)</span>
                  </Label>
                  <Input
                    id="dev-project"
                    value={form.project_name}
                    onChange={setField("project_name")}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="dev-market">
                    City / Market <span className="font-normal text-zinc-400">(optional)</span>
                  </Label>
                  <Input id="dev-market" value={form.market} onChange={setField("market")} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="dev-note">
                    Short note <span className="font-normal text-zinc-400">(optional)</span>
                  </Label>
                  <Textarea
                    id="dev-note"
                    value={form.note}
                    onChange={setField("note")}
                    rows={3}
                    maxLength={1000}
                  />
                </div>
                <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
                  <Button type="submit" className="h-11 rounded-xl px-5" disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit request"}
                  </Button>
                  <Link
                    to="/request-access"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
                  >
                    Back to choices
                  </Link>
                </div>
              </form>
            </section>
          )}

          <p className="border-t border-zinc-100 pt-6 text-sm text-zinc-500">
            Already have Developer access?{" "}
            <Link
              to="/developer-login"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Developer Login
            </Link>
          </p>
        </div>
      </AuthShell>
    </>
  );
}
