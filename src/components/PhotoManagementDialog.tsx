import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageIcon, X, GripVertical, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FileWithPreview {
  id: string;
  file: File;
  preview: string;
}

interface PhotoManagementDialogProps {
  photos: FileWithPreview[];
  onPhotosChange: (photos: FileWithPreview[]) => void;
  trigger?: React.ReactNode;
}

export function PhotoManagementDialog({ photos, onPhotosChange, trigger }: PhotoManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
    }));

    onPhotosChange([...photos, ...newFiles]);
  };

  const handleRemoveFile = (id: string) => {
    const fileToRemove = photos.find((p) => p.id === id);
    if (fileToRemove) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
    onPhotosChange(photos.filter((p) => p.id !== id));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPhotos = [...photos];
    const draggedItem = newPhotos[draggedIndex];
    newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(index, 0, draggedItem);
    
    onPhotosChange(newPhotos);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button type="button" variant="outline" className="gap-2">
            <ImageIcon className="w-4 h-4" />
            Manage Photos ({photos.length})
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Property Photos</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Drag and drop to reorder. First photo will be the main image.
          </p>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="dropzone-file"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 10MB</p>
              </div>
              <Input
                id="dropzone-file"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </label>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="relative group cursor-move border rounded-lg overflow-hidden bg-muted transition-transform hover:scale-105"
                >
                  <div className="absolute top-2 left-2 z-10 bg-background/90 rounded p-1">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  {index === 0 && (
                    <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                      Main Photo
                    </div>
                  )}
                  <img
                    src={photo.preview}
                    alt={`Property ${index + 1}`}
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-background/90 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleRemoveFile(photo.id)}
                    >
                      <X className="w-4 h-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {photos.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No photos uploaded yet</p>
              <p className="text-sm">Upload photos to showcase your property</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'} uploaded
          </p>
          <Button type="button" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
