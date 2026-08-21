import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import { resolveMediaUrlMap } from "@/lib/developments/mediaUrls";
import {
  deleteMediaRow,
  setMediaHero,
  uploadDevelopmentMediaFile,
} from "@/lib/developments/workspace";
import { toast } from "sonner";

export default function DeveloperPhotosPage() {
  const { development, canEdit, bundle, reload } = useDeveloperEditor();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const media = useMemo(
    () => bundle.media.filter((m) => !m.floor_plan_id && !m.unit_id),
    [bundle.media],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map = await resolveMediaUrlMap(media);
      if (!cancelled) setUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [media]);

  const onUpload = async (files: FileList | null) => {
    if (!files?.length || !canEdit) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const { error } = await uploadDevelopmentMediaFile({
        developmentId: development.id,
        accountId: development.account_id,
        file,
        isHero: media.length === 0,
      });
      if (error) toast.error(error);
    }
    setUploading(false);
    await reload();
  };

  const onHero = async (mediaId: string) => {
    const { error } = await setMediaHero(development.id, mediaId);
    if (error) toast.error(error);
    else {
      toast.success("Hero image updated.");
      await reload();
    }
  };

  const onDelete = async (mediaId: string) => {
    const { error } = await deleteMediaRow(mediaId);
    if (error) toast.error(error);
    else {
      toast.success("Photo removed.");
      await reload();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Media</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Project photos for the mini-site hero and gallery (private storage; signed URLs for agents).
          </p>
        </div>
        {canEdit ? (
          <label className="inline-flex cursor-pointer items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
            {uploading ? "Uploading…" : "Upload photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => void onUpload(e.target.files)}
            />
          </label>
        ) : null}
      </div>

      {media.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-600">
          No project photos yet.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => {
            const url = urls[item.id] ?? item.external_url ?? null;
            return (
              <li key={item.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                <div className="aspect-[4/3] bg-zinc-100">
                  {url ? (
                    <img src={url} alt={item.alt ?? ""} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-xs font-medium text-zinc-500">
                    {item.is_hero ? "Hero" : item.kind}
                  </span>
                  {canEdit ? (
                    <div className="flex gap-1">
                      {!item.is_hero ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => void onHero(item.id)}>
                          Set hero
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="ghost" onClick={() => void onDelete(item.id)}>
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button type="button" variant="outline" asChild>
        <Link to={`/developer/developments/${development.id}/documents`}>Continue to Documents</Link>
      </Button>
    </div>
  );
}
