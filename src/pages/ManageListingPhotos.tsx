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
  name?: string;
};

interface ManageListingPhotosProps {
  mode?: 'photos' | 'floorPlans';
}

const ManageListingPhotos: React.FC<ManageListingPhotosProps> = ({ mode = 'photos' }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Mode-specific configuration
  const config = {
    photos: {
      title: 'Manage Photos',
      description: 'Drag photos to reorder. First photo will be the main image.',
      dbField: 'photos',
      storageBucket: 'listing-photos',
      emptyMessage: 'No photos uploaded yet.',
      uploadLabel: 'Upload More Photos',
      mainLabel: '📌 Main Photo',
      itemLabel: 'Photo',
    },
    floorPlans: {
      title: 'Manage Floor Plans',
      description: 'Drag floor plans to reorder.',
      dbField: 'floor_plans',
      storageBucket: 'listing-floorplans',
      emptyMessage: 'No floor plans uploaded yet.',
      uploadLabel: 'Upload More Floor Plans',
      mainLabel: '📌 Primary Floor Plan',
      itemLabel: 'Floor Plan',
    },
  }[mode];

  useEffect(() => {
    if (!id) {
      navigate('/agent/listings');
      return;
    }
    fetchItems();
  }, [id, mode]);

  const fetchItems = async () => {
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(config.dbField)
        .eq('id', id)
        .single();

      if (error) throw error;

      const itemsData = ((data as any)?.[config.dbField] as any[]) || [];
      
      // Handle both formats: array of strings (old) or array of objects (new)
      const normalizedItems = itemsData.map((item, index) => {
        if (typeof item === 'string') {
          return { url: item, order: index };
        }
        return { ...item, order: item.order ?? index };
      });
      
      setItems(normalizedItems.sort((a, b) => a.order - b.order));
    } catch (error: any) {
      console.error(`Error fetching ${mode}:`, error);
      setLoadError(true);
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

    const updated = [...items];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);

    // Reassign order values
    const reOrdered = updated.map((p, i) => ({ ...p, order: i }));
    setItems(reOrdered);
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
    const updated = items.filter((_, i) => i !== index);
    const reOrdered = updated.map((p, i) => ({ ...p, order: i }));
    setItems(reOrdered);
    setSelectedIndexes(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIndexes.size === 0) return;
    
    const updated = items.filter((_, i) => !selectedIndexes.has(i));
    const reOrdered = updated.map((p, i) => ({ ...p, order: i }));
    setItems(reOrdered);
    setSelectedIndexes(new Set());
  };

  // Save items to database (without navigating)
  const saveItemsToDb = async (itemsToSave: Photo[]) => {
    if (!id) return false;
    
    try {
      const { error } = await supabase
        .from('listings')
        .update({ [config.dbField]: itemsToSave })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error(`Error saving ${mode}:`, error);
      return false;
    }
  };

  const handleSave = async () => {
    if (!id) return;
    
    setSaving(true);
    const success = await saveItemsToDb(items);
    setSaving(false);
    
    if (success) {
      toast.success(`${config.title.replace('Manage ', '')} updated successfully`);
    } else {
      toast.error(`Failed to save ${mode === 'photos' ? 'photos' : 'floor plans'}`);
    }
  };

  const handleSaveAndReturn = async () => {
    if (!id) return;
    
    setSaving(true);
    const success = await saveItemsToDb(items);
    setSaving(false);
    
    if (success) {
      toast.success(`${config.title.replace('Manage ', '')} saved`);
      navigate(`/agent/listings/edit/${id}`);
    } else {
      toast.error(`Failed to save ${mode === 'photos' ? 'photos' : 'floor plans'}`);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newItems: Photo[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${id}/${fileName}`;

      try {
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(config.storageBucket)
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(config.storageBucket)
          .getPublicUrl(filePath);

        newItems.push({
          url: publicUrl,
          order: items.length + newItems.length,
          name: file.name,
        });
      } catch (error: any) {
        console.error(`Error uploading ${config.itemLabel.toLowerCase()}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newItems.length > 0) {
      const updatedItems = [...items, ...newItems];
      setItems(updatedItems);
      
      // Auto-save to database immediately after upload
      const success = await saveItemsToDb(updatedItems);
      if (success) {
        toast.success(`${newItems.length} ${config.itemLabel.toLowerCase()}(s) uploaded and saved`);
      } else {
        toast.error(`${config.itemLabel}s uploaded but failed to save to database`);
      }
    }
    
    setIsUploading(false);
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
          <h1 className="text-2xl font-bold">{config.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {config.description}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/agent/listings')}
            disabled={saving || isUploading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Listings
          </Button>
          <Button
            variant="default"
            onClick={handleSaveAndReturn}
            disabled={saving || isUploading}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save & Return to Listing'
            )}
          </Button>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('item-upload-manage')?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              {config.uploadLabel}
            </>
          )}
        </Button>
        <input
          id="item-upload-manage"
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          disabled={isUploading}
        />
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteSelected}
          disabled={selectedIndexes.size === 0 || isUploading}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Selected ({selectedIndexes.size})
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {items.length} {config.itemLabel.toLowerCase()}(s) total
        </span>
      </div>

      {/* Error State */}
      {loadError && (
        <div className="text-center py-8 border-2 border-dashed border-destructive/50 rounded-lg bg-destructive/5">
          <p className="text-destructive font-medium">Failed to load {mode === 'photos' ? 'photos' : 'floor plans'}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={fetchItems}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Item Grid */}
      {!loadError && items.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">{config.emptyMessage}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => document.getElementById('item-upload-manage')?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload {config.itemLabel}s
              </>
            )}
          </Button>
        </div>
      ) : !loadError && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item, index) => (
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

              {/* Image */}
              <img
                src={item.url}
                alt={`${config.itemLabel} ${index + 1}`}
                className="w-full h-48 object-cover"
              />

              {/* Order Label */}
              <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {index === 0 ? config.mainLabel : `${config.itemLabel} #${index + 1}`}
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
