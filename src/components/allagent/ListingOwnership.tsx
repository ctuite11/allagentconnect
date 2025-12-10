const ListingOwnership = () => {
  return (
    <section className="py-24 bg-white border-y border-slate-100">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Main statement */}
          <h2 className="text-3xl md:text-5xl font-semibold text-slate-900 mb-6 tracking-tight leading-tight">
            Your Listing.
            <br />
            Your Lead.
            <br />
            <span className="text-blue-600">Always.</span>
          </h2>

          {/* Supporting text */}
          <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed mb-10">
            At AllAgentConnect, you own your relationships and your leads. We never compete with you for business. 
            Every connection you make, every deal you close—it's yours.
          </p>

          {/* Key points */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {[
              "No lead capture by platform",
              "Direct agent relationships",
              "You control your contacts",
              "Full commission transparency",
            ].map((point, index) => (
              <div
                key={index}
                className="text-sm text-slate-400 font-medium"
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
