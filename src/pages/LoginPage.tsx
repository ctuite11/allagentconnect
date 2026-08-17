import { Link } from "react-router-dom";
import { Building2, BadgeCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Seo } from "@/components/Seo";

/**
 * Public chooser: existing users pick Agent vs Developer login.
 * Auth destinations (/auth, /developer-login) are unchanged.
 */
export default function LoginPage() {
  return (
    <>
      <Seo
        title="Login | All Agent Connect"
        description="Choose agent or developer login for All Agent Connect."
        canonical="https://allagentconnect.com/login"
      />
      <AuthShell maxWidth="720px">
        <div className="space-y-8">
          <div className="text-center">
            <h1
              className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px]"
              style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
            >
              Login
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-base">
              Choose the portal that matches your account. New to AAC? Request access first.
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
                Agent Login
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">
                Sign in to the AAC agent network to manage listings, buyers, Hot Sheets, and
                collaboration with verified agents.
              </p>
              <Link
                to="/auth"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
              >
                Continue to Agent Login
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
                Developer Login
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">
                Sign in to the Developer portal to manage projects, media, units, documents, and
                publishing for AAC’s agent network.
              </p>
              <Link
                to="/developer-login"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
              >
                Continue to Developer Login
              </Link>
            </section>
          </div>

          <p className="text-center text-sm text-zinc-500">
            Need access?{" "}
            <Link
              to="/request-access"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Request Access
            </Link>
          </p>
        </div>
      </AuthShell>
    </>
  );
}
