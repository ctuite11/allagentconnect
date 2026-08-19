import { Link } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Seo } from "@/components/Seo";
import { AacTitleAccent } from "@/components/layout/AacTitleAccent";
import { agentSectionCard } from "@/lib/agentUi";
import { cn } from "@/lib/utils";

/** Same primary action as `Button` default / `bg-aac` in-app CTAs. */
const portalCta =
  "mt-auto inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-aac px-8 font-sans text-base font-semibold text-white shadow-sm transition-colors group-hover:bg-aac-hover";

const portalCard =
  "group flex min-h-[340px] flex-col rounded-3xl p-8 text-left outline-none sm:p-10 hover:border-zinc-300/90 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-2";

/**
 * Public chooser: new visitors pick Agent vs Developer before requesting access.
 * Existing users should use /login instead.
 * Destinations (/auth register, /developer-access) are unchanged.
 */
export default function RequestAccessPage() {
  return (
    <>
      <Seo
        title="Request Access | All Agent Connect"
        description="Choose agent or developer access to All Agent Connect."
        canonical="https://allagentconnect.com/request-access"
      />
      <AuthShell maxWidth="1000px">
        <div className="pt-6 sm:pt-10">
          <div className="flex flex-col items-center text-center">
            <h1 className="font-sans text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
              Request Access
            </h1>
            <AacTitleAccent className="mx-auto mt-3" />
            <p className="mt-3 max-w-2xl font-sans text-lg font-medium leading-relaxed text-zinc-600 sm:text-xl">
              Tell us how you work so we can send you to the right path. Existing users should sign
              in via Login.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Link
              to="/auth?mode=register&source=request_access_agent"
              className={cn(agentSectionCard, portalCard)}
            >
              <h2 className="font-sans text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
                Agent
              </h2>
              <AacTitleAccent className="mt-3" />
              <p className="mt-4 flex-1 font-sans text-lg leading-relaxed text-zinc-700">
                Join AAC’s verified agent network to share off-market inventory, see buyer demand,
                and collaborate with licensed professionals before deals hit the public market.
              </p>
              <span className={portalCta}>Request Agent Access</span>
            </Link>

            <Link
              to="/developer-access"
              className={cn(agentSectionCard, portalCard)}
            >
              <h2 className="font-sans text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
                Developer
              </h2>
              <AacTitleAccent className="mt-3" />
              <p className="mt-4 flex-1 font-sans text-lg leading-relaxed text-zinc-700">
                Manage and promote new developments for AAC’s agent network—projects, photos, floor
                plans, units, documents, updates, and a dedicated Developer portal.
              </p>
              <span className={portalCta}>Request Developer Access</span>
            </Link>
          </div>

          <p className="mt-8 text-center font-sans text-sm text-zinc-500 sm:text-base">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Login
            </Link>
          </p>
        </div>
      </AuthShell>
    </>
  );
}
