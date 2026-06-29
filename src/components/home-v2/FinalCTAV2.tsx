import React from "react";
import { Link } from "react-router-dom";

const FinalCTAV2 = () => {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="max-w-3xl mx-auto px-6 lg:px-16 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight tracking-tight">
          See the Market Before it Happens
        </h2>
        <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto">
          Join the private agent network where deals are made before they reach the public market.
        </p>
        <div className="mt-10">
          <Link
            to="/auth?mode=register"
            className="inline-flex bg-accent hover:bg-accent-hover text-accent-foreground font-semibold px-10 py-4 rounded-lg text-base transition-colors"
          >
            Request Access
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FinalCTAV2;
