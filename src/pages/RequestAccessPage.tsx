import { Link } from "react-router-dom";
import { Building2, BadgeCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Seo } from "@/components/Seo";

/**
 * Public chooser: new visitors pick Agent vs Developer before requesting access.
 * Existing users should use /login instead.
 */
export default function RequestAccessPage() {
  return (
    <>
      <Seo
        title="Request Access | All Agent Connect"
        description="Choose agent or developer access to All Agent Connect."
        canonical="https://allagentconnect.com/request-access"
      />
      <AuthShell maxWidth="720px">
        <div className="space-y-8">
          <div className="text-center">
            <h1
              className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px]"
              style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
            >
              Request Access
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-base">
              Tell us how you work so we can send you to the right path. Existing users should sign
              in via Login.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
                <BadgeCheck className="h-5 w-5" aria-hidden />
              </div>
              <h2
                className="text-lg font-semibold text-zinc-900"
                style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
              >
                I’m a Real Estate Agent
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">
                Join AAC’s verified agent network to share off-market inventory, see buyer demand,
                and collaborate with licensed professionals before deals hit the public market.
              </p>
              <Link
                to="/auth?mode=register&source=request_access_agent"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
              >
                Request Agent Access
              </Link>
            </section>

            <section className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
                <Building2 className="h-5 w-5" aria-hidden />
              </div>
              <h2
                className="text-lg font-semibold text-zinc-900"
                style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
              >
                I’m a Developer
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">
                Manage and promote new developments for AAC’s agent network—projects, photos, floor
                plans, units, documents, updates, and a dedicated Developer portal.
              </p>
              <Link
                to="/developer-access"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
              >
                Request Developer Access
              </Link>
            </section>
          </div>

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
              Login
            </Link>
          </p>
        </div>
      </AuthShell>
    </>
  );
}
