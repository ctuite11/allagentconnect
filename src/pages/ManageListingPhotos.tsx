import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, Upload } from 'lucide-react';
import { Loader2 } from 'lucide-react';

type Photo = {
  url: string;
  order: number;
};

const ManageListingPhotos: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate('/agent/listings');
      return;
    }
    fetchPhotos();
  }, [id]);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select('photos')
        .eq('id', id)
        .single();

      if (error) throw error;

      const photosData = (data?.photos as any[]) || [];
      
      // Handle both formats: array of strings (old) or array of objects (new)
      const normalizedPhotos = photosData.map((item, index) => {
        if (typeof item === 'string') {
          return { url: item, order: index };
        }
        return item;
      });
      
      setPhotos(normalizedPhotos.sort((a, b) => a.order - b.order));
    } catch (error: any) {
      console.error('Error fetching photos:', error);
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }

    const updated = [...photos];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);

    // Reassign order values
    const reOrdered = updated.map((p, i) => ({ ...p, order: i }));
    setPhotos(reOrdered);
    setDragIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const toggleSelected = (index: number) => {
    setSelectedIndexes(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleDeleteOne = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    const reOrdered = updated.map((p, i) => ({ ...p, order: i }));
    setPhotos(reOrdered);
    setSelectedIndexes(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIndexes.size === 0) return;
    
    const updated = photos.filter((_, i) => !selectedIndexes.has(i));
    const reOrdered = updated.map((p, i) => ({ ...p, order: i }));
    setPhotos(reOrdered);
    setSelectedIndexes(new Set());
  };

  const handleSave = async () => {
    if (!id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('listings')
        .update({ photos: photos })
        .eq('id', id);

      if (error) throw error;

      toast.success('Photos updated successfully');
      navigate(`/add-listing/${id}`);
    } catch (error: any) {
      console.error('Error saving photos:', error);
      toast.error('Failed to save photos');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newPhotos: Photo[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${id}/${fileName}`;

      try {
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('listing-photos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('listing-photos')
          .getPublicUrl(filePath);

        newPhotos.push({
          url: publicUrl,
          order: photos.length + newPhotos.length
        });
      } catch (error: any) {
        console.error('Error uploading photo:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newPhotos.length > 0) {
      setPhotos([...photos, ...newPhotos]);
      toast.success(`${newPhotos.length} photo(s) uploaded`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen pt-24">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 pt-24 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manage Photos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag photos to reorder. First photo will be the main image.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/add-listing/${id}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Listing
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('photo-upload-manage')?.click()}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload More Photos
        </Button>
        <input
          id="photo-upload-manage"
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteSelected}
          disabled={selectedIndexes.size === 0}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Selected ({selectedIndexes.size})
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {photos.length} photo(s) total
        </span>
      </div>

      {/* Photo Grid */}
      {photos.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No photos uploaded yet.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => document.getElementById('photo-upload-manage')?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Photos
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((photo, index) => (
            <div
              key={index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`relative group cursor-move border-2 rounded-lg overflow-hidden transition-all ${
                dragIndex === index ? 'opacity-50 scale-95' : ''
              } ${
                selectedIndexes.has(index) ? 'border-primary ring-2 ring-primary' : 'border-border'
              }`}
            >
              {/* Select Checkbox */}
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedIndexes.has(index)}
                  onChange={() => toggleSelected(index)}
                  className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Delete Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteOne(index);
                }}
                className="absolute top-2 right-2 z-10 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Photo */}
              <img
                src={photo.url}
                alt={`Photo ${index + 1}`}
                className="w-full h-48 object-cover"
              />

              {/* Order Label */}
              <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {index === 0 ? '📌 Main Photo' : `Photo #${index + 1}`}
                </span>
                <span className="text-xs text-muted-foreground cursor-move">
                  ⇅ Drag
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageListingPhotos;
