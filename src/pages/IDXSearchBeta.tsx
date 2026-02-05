import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RepliersListingsResponse } from "@/lib/repliers";

const RESULTS_PER_PAGE = 10;
const MIN_SEARCH_TERM_LENGTH = 2;
const NON_JSON_ERROR_MESSAGE =
  "We couldn't load MLS listings right now. Please try again in a moment.";

const buildListingsUrl = (term: string): string => {
  const params = new URLSearchParams({
    resultsPerPage: String(RESULTS_PER_PAGE),
  });
  const trimmed = term.trim();

  if (trimmed.length >= MIN_SEARCH_TERM_LENGTH) {
    params.set("searchTerm", trimmed);
  }

  return `/api/repliers/listings?${params.toString()}`;
};

const getErrorMessage = (payload: unknown): string => {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return "Unable to load listings. Please try again.";
};

export default function IDXSearchBeta() {
  const [searchTerm, setSearchTerm] = useState("");
  const [response, setResponse] = useState<RepliersListingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const url = buildListingsUrl(searchTerm);
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        throw new Error(NON_JSON_ERROR_MESSAGE);
      }

      const payload = (await response.json()) as RepliersListingsResponse;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload));
      }

      setResponse(payload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load listings.";
      setErrorMessage(message);
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  const listings = response?.listings ?? [];

  return (
    <PageShell>
      <PageHeader title="MLS Property Search (Beta)" />

      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium text-neutral-700" htmlFor="idx-search">
              Search term
            </label>
            <Input
              id="idx-search"
              value={searchTerm}
              placeholder="Search by city, neighborhood, or MLS number"
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={handleSearch}
            disabled={isLoading}
            className="rounded-xl"
          >
            {isLoading ? "Searching..." : "Search"}
          </Button>
        </div>

        {errorMessage ? (
          <p className="text-sm text-red-500">{errorMessage}</p>
        ) : null}

        {response ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-500">
              Showing {listings.length} of {(response.count ?? listings.length).toLocaleString()} listings
            </p>
            <ul className="space-y-2">
              {listings.map((listing, index) => {
                const street = listing.address?.streetName ?? "";
                const city = listing.address?.city ?? "";
                const label = [street, city].filter(Boolean).join(", ") || "Listing";
                const key = listing.mlsNumber ?? `${label}-${index}`;

                return (
                  <li key={key} className="rounded-xl border border-neutral-200 p-3">
                    <p className="font-medium text-neutral-800">{label}</p>
                    <p className="text-sm text-neutral-500">
                      {listing.listPrice ? `$${listing.listPrice.toLocaleString()}` : "Price unavailable"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
