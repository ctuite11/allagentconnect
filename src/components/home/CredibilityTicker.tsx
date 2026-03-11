const tickerItems = [
  "Coming Soon — Charlestown MA",
  "Off Market — Miami FL",
  "Buyer Need — Seaport Boston",
  "Seller Match — North End Boston",
  "New Listing Intel — Back Bay Boston",
  "Coming Soon — Charlestown MA",
  "Off Market — Miami FL",
  "Buyer Need — Seaport Boston",
  "Seller Match — North End Boston",
  "New Listing Intel — Back Bay Boston",
];

export default function CredibilityTicker() {
  return (
    <div className="mt-16 border-t border-zinc-800 pt-8">
      <p className="text-center text-sm text-zinc-500 mb-5">
        Agents sharing off-market inventory across the AAC network
      </p>

      <div className="relative overflow-hidden group">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-zinc-950 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-zinc-950 to-transparent z-10" />

        <div className="flex whitespace-nowrap animate-[ticker_30s_linear_infinite] group-hover:[animation-play-state:paused]">
          {tickerItems.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 mx-4 text-xs text-zinc-500"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60 shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
