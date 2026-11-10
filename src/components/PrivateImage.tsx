import { createContext, forwardRef, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { privateStorageObject, PRIVATE_MEDIA_TTL } from "../../supabase/functions/_shared/privateListingMedia";
import { isDcmlsHost } from "@/lib/host";

type Scope = { token?: string; hotSheetId?: string; dcmls?: boolean };
const MediaScope = createContext<Scope>({});
const scopedMedia = new Map<string, { expires: number; result: Promise<Record<string, (string | null)[]>> }>();

async function loadScopedMedia(listingId: string, scope: Scope) {
  const session = scope.token || scope.dcmls ? null : (await supabase.auth.getSession()).data.session;
  const cacheKey = `${scope.token ?? session?.user.id ?? "signed-out"}|${scope.hotSheetId ?? ""}|${listingId}|${Boolean(scope.dcmls)}`;
  const cached = scopedMedia.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.result;
  const result = (async () => {
    const { data, error } = await supabase.functions.invoke("shared-listing-photos", {
      body: { token: scope.token, hot_sheet_id: scope.hotSheetId, listing_id: listingId, ...(scope.dcmls ? { dcmls: true } : {}) },
    });
    if (error) throw error;
    return data as Record<string, (string | null)[]>;
  })();
  scopedMedia.set(cacheKey, { expires: Date.now() + (PRIVATE_MEDIA_TTL - 90) * 1000, result });
  if (scopedMedia.size > 200) scopedMedia.delete(scopedMedia.keys().next().value!);
  try { return await result; } catch (error) { scopedMedia.delete(cacheKey); throw error; }
}

/** Opaque buyer credentials stay in POST bodies; they never enter image URLs. */
export function PrivateMediaScope({ token, hotSheetId, dcmls, children }: Scope & { children: ReactNode }) {
  return <MediaScope.Provider value={{ token, hotSheetId, dcmls }}>{children}</MediaScope.Provider>;
}

export function usePrivateMediaUrl(source: string | undefined, bucket = "listing-photos"): string | undefined {
  const context = useContext(MediaScope);
  const scope = { ...context, dcmls: context.dcmls ?? (!context.token && !context.hotSheetId && isDcmlsHost()) };
  const key = `${source ?? ""}|${scope.token ?? ""}|${scope.hotSheetId ?? ""}|${Boolean(scope.dcmls)}`;
  const [result, setResult] = useState<{ key: string; url?: string }>();
  const object = source ? privateStorageObject(source, bucket, import.meta.env.VITE_SUPABASE_URL) : null;
  const marker = source?.match(/^aac-private:\/\/([0-9a-f-]{36})\/(photos|floor_plans)\/(\d+)$/i);
  const requiresSigning = Boolean(object || marker);
  useEffect(() => {
    if (!source || !requiresSigning) return;
    let cancelled = false;
    const refresh = async () => {
      let url: string | undefined;
      try {
        if (marker) {
          const data = await loadScopedMedia(marker[1], scope);
          url = data?.[marker[2]]?.[Number(marker[3])] ?? undefined;
        } else if (object) {
          const { data, error } = await supabase.storage.from(object.bucket).createSignedUrl(object.path, PRIVATE_MEDIA_TTL);
          if (!error) url = data?.signedUrl;
        }
      } catch { /* Keep private content unavailable on authorization/network failure. */ }
      if (!cancelled) setResult({ key, url });
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), (PRIVATE_MEDIA_TTL - 60) * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
    // The key includes the complete credential/scope. Do not retain a previous
    // listing image while the next authorized request is in flight.
  }, [key, requiresSigning, bucket]);
  if (!requiresSigning) return source;
  return result?.key === key ? result.url : undefined;
}

export const PrivateImage = forwardRef<HTMLImageElement, ComponentProps<"img"> & { storageBucket?: string }>(
  function PrivateImage({ src, storageBucket, ...props }, ref) {
    const resolved = usePrivateMediaUrl(src, storageBucket);
    return <img {...props} ref={ref} src={resolved || "/placeholder.svg"} referrerPolicy="no-referrer" />;
  },
);

export function PrivateFileLink({ href, storageBucket, children, ...props }: ComponentProps<"a"> & { storageBucket?: string }) {
  const resolved = usePrivateMediaUrl(href, storageBucket ?? "listing-documents");
  return <a {...props} href={resolved} aria-disabled={!resolved} referrerPolicy="no-referrer" rel="noopener noreferrer">{children}</a>;
}
