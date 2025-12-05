import { Building2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CompanyLogoUploadProps {
  logoUrl: string;
  uploadingLogo: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}

const CompanyLogoUpload = ({
  logoUrl,
  uploadingLogo,
  onUpload,
  onRemove,
}: CompanyLogoUploadProps) => {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Logo Container */}
      <div className="relative group">
        {logoUrl ? (
          <div className="relative">
            <div className="w-40 h-24 rounded-xl bg-muted/50 border-2 border-border flex items-center justify-center p-3">
              <img
                src={logoUrl}
                alt="Company Logo"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <Button
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="w-40 h-24 rounded-xl bg-muted/50 flex items-center justify-center border-2 border-dashed border-border">
            <Building2 className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Upload Button */}
      <div>
        <Input
          type="file"
          accept="image/*"
          onChange={onUpload}
          disabled={uploadingLogo}
          className="hidden"
          id="logo-upload"
        />
        <Label
          htmlFor="logo-upload"
          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
        >
          <Upload className="h-4 w-4" />
          {uploadingLogo ? "Uploading..." : "Upload Logo"}
        </Label>
      </div>
    </div>
  );
};

export default CompanyLogoUpload;
