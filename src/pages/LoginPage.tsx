import { Link } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Seo } from "@/components/Seo";
import { AacTitleAccent } from "@/components/layout/AacTitleAccent";
import { agentSectionCard } from "@/lib/agentUi";
import { cn } from "@/lib/utils";

/** Same primary action as `Button` default / `bg-aac` in-app CTAs. */
const portalCta =
  "mt-auto inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-aac px-8 font-sans text-base font-semibold text-white shadow-sm transition-colors group-hover:bg-aac-hover";

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
      <AuthShell maxWidth="1000px">
        <div className="pt-6 sm:pt-10">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-sans text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Welcome back
          </h1>
          <AacTitleAccent className="mx-auto mt-3" />
          <p className="mt-3 max-w-2xl font-sans text-lg font-medium leading-relaxed text-zinc-600 sm:text-xl">
            Choose how you access All Agent Connect.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <Link
            to="/auth"
            className={cn(
              agentSectionCard,
              "group flex min-h-[340px] flex-col rounded-3xl p-8 text-left outline-none sm:p-10",
              "hover:border-zinc-300/90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
              "focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2",
            )}
          >
            <h2 className="font-sans text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
              Agent
            </h2>
              <AacTitleAccent className="mt-3" />
              <p className="mt-4 flex-1 font-sans text-lg leading-relaxed text-zinc-700">
                Listings, buyer demand, Hot Sheets, Communications, and the AAC agent network.
              </p>
            <span className={portalCta}>Agent Login</span>
          </Link>

          <Link
            to="/developer-login"
            className={cn(
              agentSectionCard,
              "group flex min-h-[340px] flex-col rounded-3xl p-8 text-left outline-none sm:p-10",
              "hover:border-zinc-300/90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
              "focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2",
            )}
          >
            <h2 className="font-sans text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
              Developer
            </h2>
              <AacTitleAccent className="mt-3" />
              <p className="mt-4 flex-1 font-sans text-lg leading-relaxed text-zinc-700">
                Manage developments, units, floor plans, media, documents, and project updates.
              </p>
            <span className={portalCta}>Developer Login</span>
          </Link>
        </div>

        <p className="mt-8 text-center font-sans text-sm text-zinc-500 sm:text-base">
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
