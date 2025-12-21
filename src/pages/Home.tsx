import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Top bar */}
      <header className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <Logo size="md" />

        <Button
          variant="ghost"
          onClick={() => navigate("/auth")}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          Sign in
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
            Where real deals get done.
          </h1>

          <p className="mt-6 text-lg text-slate-600 max-w-xl mx-auto">
            A private, agent-only network where real estate professionals collaborate, share off-market
            opportunities, and close real transactions — not leads.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate("/auth?mode=register")}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 px-6"
            >
              Request Access
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/auth")}
              className="rounded-xl h-11 px-6 border-slate-200 text-slate-900 hover:bg-slate-50"
            >
              Sign in
            </Button>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            License verification required. Most approvals are fast.
          </p>
        </section>

        {/* Proof / trust */}
        <section className="bg-slate-50/60 border-y border-slate-100 py-16">
          <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Built by agents. Proven by results.</h2>
              <p className="mt-3 text-slate-600">
                AllAgentConnect has helped agents collaborate and close transactions since{" "}
                <span className="font-medium text-slate-900">2016</span>.
                No hype — just a network that works.
              </p>
            </div>

            <ul className="grid gap-3">
              {[
                "Founded in 2016",
                "Agent-to-agent collaboration",
                "Off-market opportunities & referrals",
                "Grown through agent relationships",
              ].map((txt) => (
                <li key={txt}>
                  <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow-sm border border-slate-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-slate-700">{txt}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Differentiation */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-semibold text-slate-900 text-center mb-12">
            This isn't another real estate platform.
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Feature
              title="No lead buying"
              body="We don't sell leads. Agents connect with each other directly to share real opportunities."
            />
            <Feature
              title="Agent-only network"
              body="Every member is a licensed real estate professional. No consumers, no noise."
            />
            <Feature
              title="Off-market focus"
              body="Access exclusive listings and opportunities you won't find on the MLS."
            />
          </div>
        </section>

        {/* How it works */}
        <section className="bg-slate-900 text-white py-20">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-semibold text-center mb-12">How it works</h2>

            <div className="grid md:grid-cols-3 gap-8">
              <Step n="1" title="Request access & verify your license" />
              <Step n="2" title="Join the network of verified agents" />
              <Step n="3" title="Collaborate, share deals, and close" />
            </div>

            <p className="mt-12 text-center text-slate-400 text-sm">
              No funnels. No spam. No noise.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Don't miss deals you'll never see on the MLS.
            </h2>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                onClick={() => navigate("/auth?mode=register")}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 px-6"
              >
                Request Access
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/auth")}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Already invited? Sign in
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} AllAgentConnect</span>
          <span>Trusted collaboration for licensed agents</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm">{body}</p>
    </div>
  );
}

function Step({ n, title }: { n: string; title: string }) {
  return (
    <div className="text-center">
      <div className="text-emerald-400 text-sm font-medium mb-2">STEP {n}</div>
      <p className="text-white font-medium">{title}</p>
    </div>
  );
}
