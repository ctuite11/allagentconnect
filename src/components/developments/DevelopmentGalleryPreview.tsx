import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Images, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { DevelopmentMediaRow } from "@/lib/developments/types";
import {
  projectGalleryPreviewPhotos,
  projectGalleryVideos,
  projectLevelPhotos,
} from "@/lib/developments/mediaScope";

type Props = {
  developmentName: string;
  media: DevelopmentMediaRow[];
  mediaUrls: Record<string, string>;
  className?: string;
};

export function DevelopmentGalleryPreview({
  developmentName,
  media,
  mediaUrls,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const previewPhotos = useMemo(() => projectGalleryPreviewPhotos(media, 5), [media]);
  const allPhotos = useMemo(() => projectLevelPhotos(media), [media]);
  const videos = useMemo(() => projectGalleryVideos(media), [media]);

  const previewWithUrls = previewPhotos
    .map((photo) => ({ photo, url: mediaUrls[photo.id] }))
    .filter((row): row is { photo: DevelopmentMediaRow; url: string } => Boolean(row.url));

  const allPhotosWithUrls = allPhotos
    .map((photo) => ({ photo, url: mediaUrls[photo.id] }))
    .filter((row): row is { photo: DevelopmentMediaRow; url: string } => Boolean(row.url));

  const openAt = (index: number) => {
    setActiveIndex(index);
    setOpen(true);
  };

  const openFullGallery = () => {
    setActiveIndex(0);
    setOpen(true);
  };

  if (previewWithUrls.length === 0 && videos.length === 0) {
    return (
      <section id="gallery" className={cn("scroll-mt-24 space-y-3", className)}>
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center">
          <p className="text-sm text-zinc-600">Project photography coming soon.</p>
        </div>
      </section>
    );
  }

  const desktopTiles = previewWithUrls.slice(0, 5);
  const lead = desktopTiles[0];
  const side = desktopTiles.slice(1, 5);
  const remaining = Math.max(0, allPhotosWithUrls.length - desktopTiles.length);

  return (
    <section id="gallery" className={cn("scroll-mt-24 space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900">Photos</h2>
          <p className="max-w-2xl text-sm text-zinc-600">
            Project photography for buyer conversations — before the fine print.
          </p>
        </div>
        {allPhotosWithUrls.length > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={openFullGallery}>
            <Images className="mr-1.5 h-4 w-4" />
            View all photos
            {allPhotosWithUrls.length > 1 ? ` (${allPhotosWithUrls.length})` : ""}
          </Button>
        ) : null}
      </div>

      {/* Desktop mosaic */}
      {lead ? (
        <div className="hidden gap-2 md:grid md:grid-cols-4 md:grid-rows-2 md:h-[min(52vh,420px)]">
          <button
            type="button"
            onClick={() => openAt(allPhotosWithUrls.findIndex((r) => r.photo.id === lead.photo.id))}
            className={cn(
              "group relative overflow-hidden rounded-2xl bg-zinc-100 text-left",
              side.length === 0 ? "md:col-span-4 md:row-span-2" : "md:col-span-2 md:row-span-2",
            )}
          >
            <img
              src={lead.url}
              alt={lead.photo.alt || developmentName}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </button>
          {side.map((tile, idx) => {
            const globalIndex = allPhotosWithUrls.findIndex((r) => r.photo.id === tile.photo.id);
            const isLast = idx === side.length - 1 && remaining > 0;
            return (
              <button
                key={tile.photo.id}
                type="button"
                onClick={() => openAt(Math.max(0, globalIndex))}
                className="group relative overflow-hidden rounded-2xl bg-zinc-100 text-left"
              >
                <img
                  src={tile.url}
                  alt={tile.photo.alt || developmentName}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                {isLast ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-semibold text-white">
                    +{remaining} more
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Mobile: large lead + swipe strip */}
      {previewWithUrls.length > 0 ? (
        <div className="md:hidden space-y-3">
          <Carousel opts={{ align: "start", loop: previewWithUrls.length > 1 }}>
            <CarouselContent className="-ml-2">
              {previewWithUrls.map((tile) => {
                const globalIndex = allPhotosWithUrls.findIndex((r) => r.photo.id === tile.photo.id);
                return (
                  <CarouselItem key={tile.photo.id} className="basis-[92%] pl-2">
                    <button
                      type="button"
                      onClick={() => openAt(Math.max(0, globalIndex))}
                      className="block w-full overflow-hidden rounded-2xl bg-zinc-100 text-left"
                    >
                      <img
                        src={tile.url}
                        alt={tile.photo.alt || developmentName}
                        className="aspect-[4/3] w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            {previewWithUrls.length > 1 ? (
              <>
                <CarouselPrevious className="left-2 top-1/2 border-white/80 bg-white/90" />
                <CarouselNext className="right-2 top-1/2 border-white/80 bg-white/90" />
              </>
            ) : null}
          </Carousel>
          <p className="text-center text-xs text-zinc-500">
            Swipe for more · tap to open gallery
          </p>
        </div>
      ) : null}

      {videos.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {videos.map((item) => {
            const url = mediaUrls[item.id] || item.external_url;
            if (!url) return null;
            return (
              <a
                key={item.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
              >
                <span className="rounded-full bg-zinc-900 p-2 text-white">
                  <Play className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-zinc-900">
                    {item.kind === "virtual_tour" ? "Virtual tour" : "Video"}
                  </span>
                  <span className="block truncate text-sm text-zinc-500">
                    {item.caption || item.alt || "Open media"}
                  </span>
                </span>
                <ExternalLink className="h-4 w-4 text-zinc-400" />
              </a>
            );
          })}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl gap-0 overflow-hidden border-0 bg-zinc-950 p-0 text-white sm:rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{developmentName} photo gallery</DialogTitle>
            <DialogDescription>Browse project photography.</DialogDescription>
          </DialogHeader>
          {allPhotosWithUrls.length > 0 ? (
            <div className="relative">
              <button
                type="button"
                className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                onClick={() => setOpen(false)}
                aria-label="Close gallery"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="relative flex min-h-[50vh] items-center justify-center bg-black px-12 py-10">
                <img
                  src={allPhotosWithUrls[Math.min(activeIndex, allPhotosWithUrls.length - 1)]?.url}
                  alt={
                    allPhotosWithUrls[Math.min(activeIndex, allPhotosWithUrls.length - 1)]?.photo.alt ||
                    developmentName
                  }
                  className="max-h-[70vh] w-full object-contain"
                />
                {allPhotosWithUrls.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 hover:bg-white/25"
                      onClick={() =>
                        setActiveIndex((i) => (i - 1 + allPhotosWithUrls.length) % allPhotosWithUrls.length)
                      }
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 hover:bg-white/25"
                      onClick={() => setActiveIndex((i) => (i + 1) % allPhotosWithUrls.length)}
                      aria-label="Next photo"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-sm text-white/80">
                <span>
                  {Math.min(activeIndex + 1, allPhotosWithUrls.length)} / {allPhotosWithUrls.length}
                </span>
                <span className="truncate">
                  {allPhotosWithUrls[Math.min(activeIndex, allPhotosWithUrls.length - 1)]?.photo.caption ||
                    developmentName}
                </span>
              </div>
              {allPhotosWithUrls.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto px-4 pb-4">
                  {allPhotosWithUrls.map((row, idx) => (
                    <button
                      key={row.photo.id}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className={cn(
                        "h-16 w-20 shrink-0 overflow-hidden rounded-md ring-2 ring-transparent",
                        idx === activeIndex && "ring-white",
                      )}
                    >
                      <img src={row.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
