import { useCallback, useEffect, useState } from "react";
import { fetchDevelopmentBrowseCards, fetchDevelopmentBySlug } from "@/lib/developments/queries";
import type { DevelopmentBrowseCard, DevelopmentDetailBundle } from "@/lib/developments/types";

export function useDevelopmentBrowse() {
  const [cards, setCards] = useState<DevelopmentBrowseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchDevelopmentBrowseCards();
    setCards(result.cards);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { cards, loading, error, reload };
}

export function useDevelopmentDetail(slug: string | undefined) {
  const [bundle, setBundle] = useState<DevelopmentDetailBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(async () => {
    if (!slug) {
      setBundle(null);
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotFound(false);
    const result = await fetchDevelopmentBySlug(slug);
    if (result.error) {
      setBundle(null);
      setError(result.error);
      setNotFound(false);
    } else if (!result.bundle) {
      setBundle(null);
      setNotFound(true);
    } else {
      setBundle(result.bundle);
      setNotFound(false);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { bundle, loading, error, notFound, reload };
}
