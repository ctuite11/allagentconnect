import { Search, Target, MessageSquare, Bell, Globe } from "lucide-react";

const items = [
  { icon: Search, label: "Off-Market Listings" },
  { icon: Target, label: "Buyer Demand" },
  { icon: MessageSquare, label: "Referrals" },
  { icon: Bell, label: "Seller Match" },
  { icon: Globe, label: "Agent Collaboration" },
];

export default function NetworkResultsSection() {
  return (
    <section className="py-20 md:py-28 bg-white text-zinc-900">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Turning network intelligence
            <br className="hidden md:block" />
            into real results
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
            Every connection, listing, and match flows through the AAC network — turning data into deals.
          </p>
        </div>

        {/* Hub icon grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 max-w-4xl mx-auto">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                <Icon className="h-7 w-7 text-zinc-600" />
              </div>
              <span className="text-sm font-medium text-zinc-700">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
