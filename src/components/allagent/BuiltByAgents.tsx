const BuiltByAgents = () => {
  const points = [
    "Designed from real transactions",
    "Solves actual market pain points",
    "Field-tested, not theoretical",
    "Continuously improved by agent feedback",
  ];

  return (
    <section className="py-24 bg-slate-50">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Section header */}
          <p className="text-sm font-medium tracking-wide uppercase text-muted-foreground mb-3">
            Our Story
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 mb-4 tracking-tight">
            Built by Agents. For Agents.
          </h2>
          <p className="text-slate-500 text-lg mb-10 max-w-xl mx-auto">
            Every feature exists because an agent needed it in a real transaction.
          </p>

          {/* Points */}
          <div className="flex flex-wrap justify-center gap-4">
            {points.map((point, index) => (
              <span
                key={index}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-full"
              >
                {point}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BuiltByAgents;
