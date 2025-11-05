import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PhotoGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: any[];
  floorPlans: any[];
  videos?: string[];
  virtualTours?: string[];
  initialTab?: string;
  initialIndex?: number;
}

const PhotoGalleryDialog = ({
  open,
  onOpenChange,
  photos,
  floorPlans,
  videos = [],
  virtualTours = [],
  initialTab = "photos",
  initialIndex = 0,
}: PhotoGalleryDialogProps) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialIndex);
  const [currentFloorPlanIndex, setCurrentFloorPlanIndex] = useState(0);
  const [activeTab, setActiveTab] = useState(initialTab);

  const hasPhotos = photos && photos.length > 0;
  const hasFloorPlans = floorPlans && floorPlans.length > 0;
  const hasVideos = videos && videos.length > 0;
  const hasVirtualTours = virtualTours && virtualTours.length > 0;

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const nextFloorPlan = () => {
    setCurrentFloorPlanIndex((prev) => (prev + 1) % floorPlans.length);
  };

  const prevFloorPlan = () => {
    setCurrentFloorPlanIndex((prev) => (prev - 1 + floorPlans.length) % floorPlans.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <TabsList>
              {hasPhotos && <TabsTrigger value="photos">Photos ({photos.length})</TabsTrigger>}
              {hasFloorPlans && <TabsTrigger value="floorplans">Floor Plans ({floorPlans.length})</TabsTrigger>}
              {hasVideos && <TabsTrigger value="videos">Videos ({videos.length})</TabsTrigger>}
              {hasVirtualTours && <TabsTrigger value="tours">Virtual Tours ({virtualTours.length})</TabsTrigger>}
            </TabsList>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden">
            {hasPhotos && (
              <TabsContent value="photos" className="h-full m-0">
                <div className="relative h-full flex items-center justify-center bg-black">
                  <img
                    src={photos[currentPhotoIndex]?.url}
                    alt={`Photo ${currentPhotoIndex + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                  {photos.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2"
                        onClick={prevPhoto}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                        onClick={nextPhoto}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full">
                        {currentPhotoIndex + 1} / {photos.length}
                      </div>
                    </>
                  )}
                </div>
                <div className="p-4 grid grid-cols-6 gap-2 overflow-y-auto max-h-32">
                  {photos.map((photo, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPhotoIndex(index)}
                      className={`aspect-video rounded overflow-hidden border-2 ${
                        index === currentPhotoIndex ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <img src={photo.url} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </TabsContent>
            )}

            {hasFloorPlans && (
              <TabsContent value="floorplans" className="h-full m-0">
                <div className="relative h-full flex items-center justify-center bg-black">
                  <img
                    src={floorPlans[currentFloorPlanIndex]?.url}
                    alt={`Floor Plan ${currentFloorPlanIndex + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                  {floorPlans.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2"
                        onClick={prevFloorPlan}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                        onClick={nextFloorPlan}
                      >
                        <ChevronRight className="h-6 w-6" />
                      </Button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full">
                        {currentFloorPlanIndex + 1} / {floorPlans.length}
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
            )}

            {hasVideos && (
              <TabsContent value="videos" className="h-full m-0 p-4">
                <div className="space-y-4">
                  {videos.map((video, index) => (
                    <div key={index} className="aspect-video">
                      <video controls className="w-full h-full rounded-lg">
                        <source src={video} />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}

            {hasVirtualTours && (
              <TabsContent value="tours" className="h-full m-0 p-4">
                <div className="space-y-4">
                  {virtualTours.map((tour, index) => (
                    <div key={index} className="aspect-video">
                      <iframe
                        src={tour}
                        className="w-full h-full rounded-lg"
                        allowFullScreen
                        title={`Virtual Tour ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoGalleryDialog;
