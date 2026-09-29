import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDcmlsConsumerPropertyPath } from "@/lib/host";

interface DcmlsListing {
  id: string;
  address: string;
  city: string;
  state: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  status: string | null;
  photos: unknown;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);

const resolvePhoto = (photos: unknown): string | null => {
  if (!photos || !Array.isArray(photos) || photos.length === 0) return null;
  const p = photos[0] as string | { url?: string };
  if (typeof p === "string") return p;
  if (p?.url) {
    if (p.url.startsWith("http")) return p.url;
    const { data } = supabase.storage.from("listing-photos").getPublicUrl(p.url);
    return data.publicUrl;
  }
  return null;
};

const statusBadge = (status: string | null) => {
  const s = (status || "").toLowerCase();
  if (s.includes("coming")) return "DCMLS COMING SOON";
  if (s.includes("off")) return "DCMLS OFF-MARKET";
  return "DCMLS EXCLUSIVE";
};

const DcmlsSeeItFirst: React.FC = () => {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [listings, setListings] = useState<DcmlsListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchListings = async () => {
      const { data } = await supabase
        .from("dcmls_listings_public")
        .select(
          "id, address, city, state, price, bedrooms, bathrooms, square_feet, status, photos",
        )
        .order("created_at", { ascending: false })
        .limit(8);
      if (!cancelled && data) setListings(data as DcmlsListing[]);
      if (!cancelled) setLoading(false);
    };
    void fetchListings();
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollByCard = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 360);
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  if (loading) {
    return (
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
          <div className="h-10 w-72 animate-pulse rounded bg-neutral-100" />
          <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-neutral-100" />
          <div className="mt-10 flex gap-4 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[280px] w-[min(86vw,320px)] shrink-0 animate-pulse rounded-sm bg-neutral-100"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (listings.length === 0) {
    return (
      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 sm:flex-row sm:items-end sm:justify-between sm:px-8 lg:px-10">
          <div>
            <h2 className="font-['Instrument_Serif'] text-3xl tracking-[-0.02em] text-neutral-950 md:text-4xl">
              Search on Direct Connect
            </h2>
            <p className="mt-2 max-w-xl font-['Manrope'] text-[15px] text-neutral-600">
              Find more homes before they&apos;re available on other websites.
            </p>
          </div>
          <Link
            to="/browse?dcmls=1"
            className="inline-flex h-11 items-center justify-center rounded-md bg-neutral-950 px-5 font-['Manrope'] text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Browse listings
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <h2 className="font-['Instrument_Serif'] text-3xl tracking-[-0.02em] text-neutral-950 md:text-[2.5rem]">
              Search on Direct Connect
            </h2>
            <p className="mt-2 max-w-xl font-['Manrope'] text-[15px] leading-relaxed text-neutral-600">
              Find more homes before they&apos;re available on other websites.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label="Previous listings"
              onClick={() => scrollByCard(-1)}
              className="flex h-10 w-10 items-center justify-center border border-neutral-300 text-neutral-800 transition-colors hover:border-neutral-900 hover:bg-neutral-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next listings"
              onClick={() => scrollByCard(1)}
              className="flex h-10 w-10 items-center justify-center border border-neutral-300 text-neutral-800 transition-colors hover:border-neutral-900 hover:bg-neutral-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="mt-10 flex gap-4 overflow-x-auto pb-2 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {listings.map((listing) => {
            const photo = resolvePhoto(listing.photos);
            return (
              <button
                key={listing.id}
                type="button"
                onClick={() => navigate(getDcmlsConsumerPropertyPath(listing.id))}
                className="group w-[min(86vw,300px)] shrink-0 cursor-pointer text-left"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                  {photo ? (
                    <img
                      src={photo}
                      alt={listing.address}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Home className="h-10 w-10 text-neutral-300" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center rounded-full bg-neutral-950 px-2.5 py-1 font-['Manrope'] text-[10px] font-semibold tracking-[0.06em] text-white">
                      SEARCH
                    </span>
                    <span className="inline-flex items-center rounded-full border border-neutral-900/15 bg-white px-2.5 py-1 font-['Manrope'] text-[10px] font-semibold tracking-[0.04em] text-neutral-900">
                      {statusBadge(listing.status)}
                    </span>
                  </div>
                </div>
                <div className="pt-3">
                  <p className="font-['Manrope'] text-[15px] font-semibold text-neutral-950">
                    {formatPrice(listing.price)}
                  </p>
                  <p className="mt-0.5 truncate font-['Manrope'] text-sm text-neutral-800">
                    {listing.address}
                  </p>
                  <p className="font-['Manrope'] text-sm text-neutral-500">
                    {listing.city}, {listing.state}
                  </p>
                </div>
              </button>
            );
          })}

          <div className="flex w-[min(86vw,300px)] shrink-0 flex-col justify-between bg-neutral-950 p-7 text-white">
            <div>
              <h3 className="font-['Instrument_Serif'] text-[1.65rem] leading-tight tracking-[-0.02em]">
                Search on Direct Connect
              </h3>
              <p className="mt-3 font-['Manrope'] text-sm leading-relaxed text-white/75">
                Browse agent-published homes — including off-market and coming
                soon — before they hit other sites.
              </p>
            </div>
            <Link
              to="/browse?dcmls=1"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-white px-4 font-['Manrope'] text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
            >
              Get early access
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DcmlsSeeItFirst;
