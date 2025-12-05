import { User, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfilePhotoUploadProps {
  headshotUrl: string;
  uploadingHeadshot: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  aacId?: string | null;
}

const ProfilePhotoUpload = ({
  headshotUrl,
  uploadingHeadshot,
  onUpload,
  onRemove,
  aacId,
}: ProfilePhotoUploadProps) => {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Photo Container */}
      <div className="relative group">
        {headshotUrl ? (
          <div className="relative">
            <img
              src={headshotUrl}
              alt="Profile"
              className="w-36 h-36 rounded-full object-cover border-4 border-border shadow-lg"
            />
            <Button
              size="icon"
              variant="destructive"
              className="absolute -top-1 -right-1 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="w-36 h-36 rounded-full bg-muted flex items-center justify-center border-4 border-dashed border-border">
            <User className="h-16 w-16 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Agent ID */}
      {aacId && (
        <p className="text-xs text-muted-foreground font-mono">{aacId}</p>
      )}

      {/* Upload Button */}
      <div>
        <Input
          type="file"
          accept="image/*"
          onChange={onUpload}
          disabled={uploadingHeadshot}
          className="hidden"
          id="headshot-upload"
        />
        <Label
          htmlFor="headshot-upload"
          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
        >
          <Upload className="h-4 w-4" />
          {uploadingHeadshot ? "Uploading..." : "Upload Photo"}
        </Label>
      </div>
    </div>
  );
};

export default ProfilePhotoUpload;
