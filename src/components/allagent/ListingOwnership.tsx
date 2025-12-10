const ListingOwnership = () => {
  return (
    <section className="py-32 bg-slate-950 border-y border-slate-800">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main statement */}
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-8 tracking-tight leading-[1.1]">
            Your Listing.
            <br />
            Your Lead.
            <br />
            <span className="text-blue-500">Always.</span>
          </h2>

          {/* Supporting text */}
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            At AllAgentConnect, you own your relationships and your leads. We never compete with you for business. 
            Every connection you make, every deal you close—it's yours.
          </p>

          {/* Key points */}
          <div className="flex flex-wrap justify-center gap-6 mt-12">
            {[
              "No lead capture by platform",
              "Direct agent relationships",
              "You control your contacts",
              "Full commission transparency",
            ].map((point, index) => (
              <div
                key={index}
                className="text-sm text-slate-500 uppercase tracking-wide font-medium"
              >
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ListingOwnership;
