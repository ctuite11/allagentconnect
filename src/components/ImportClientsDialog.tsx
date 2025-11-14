import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const clientRowSchema = z.object({
  first_name: z.string().trim().min(2, "First name must be at least 2 characters").max(100),
  last_name: z.string().trim().min(2, "Last name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  client_type: z.enum(['buyer', 'seller', 'renter', 'agent', 'lender', 'attorney', 'inspector', 'other', '']).optional(),
});

interface ImportClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onImportComplete: () => void;
}

interface ParsedClient {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  client_type?: string;
}

interface ValidationResult {
  valid: ParsedClient[];
  errors: Array<{ row: number; errors: string[] }>;
}

export function ImportClientsDialog({ open, onOpenChange, agentId, onImportComplete }: ImportClientsDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);

  const parseCSV = (text: string): ParsedClient[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Parse header
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    // Find column indices
    const firstNameIdx = header.findIndex(h => h.includes('first') && h.includes('name'));
    const lastNameIdx = header.findIndex(h => h.includes('last') && h.includes('name'));
    const emailIdx = header.findIndex(h => h.includes('email'));
    const phoneIdx = header.findIndex(h => h.includes('phone'));
    const clientTypeIdx = header.findIndex(h => h.includes('client') && h.includes('type'));

    if (firstNameIdx === -1 || lastNameIdx === -1 || emailIdx === -1) {
      throw new Error("CSV must contain 'First Name', 'Last Name', and 'Email' columns");
    }

    const clients: ParsedClient[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      if (values.length < 3) continue; // Skip invalid rows
      
      clients.push({
        first_name: values[firstNameIdx] || '',
        last_name: values[lastNameIdx] || '',
        email: values[emailIdx] || '',
        phone: phoneIdx !== -1 ? values[phoneIdx] : '',
        client_type: clientTypeIdx !== -1 ? values[clientTypeIdx] : '',
      });
    }

    return clients;
  };

  const validateClients = (clients: ParsedClient[]): ValidationResult => {
    const valid: ParsedClient[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    clients.forEach((client, index) => {
      const result = clientRowSchema.safeParse(client);
      
      if (result.success) {
        valid.push({
          first_name: result.data.first_name,
          last_name: result.data.last_name,
          email: result.data.email,
          phone: result.data.phone,
          client_type: result.data.client_type,
        });
      } else {
        errors.push({
          row: index + 2, // +2 because index 0 is row 2 (after header)
          errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        });
      }
    });

    return { valid, errors };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV or Excel file");
      return;
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      toast.error("File size must be less than 20MB");
      return;
    }

    setUploading(true);
    setValidationResult(null);

    try {
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        // Parse CSV directly
        const text = await file.text();
        const clients = parseCSV(text);
        const result = validateClients(clients);
        setValidationResult(result);
        
        if (result.valid.length === 0) {
          toast.error("No valid clients found in file");
        } else {
          toast.success(`Found ${result.valid.length} valid client(s)`);
        }
      } else {
        toast.error("Excel files require manual parsing. Please save as CSV and try again.");
      }
    } catch (error: any) {
      console.error("Error parsing file:", error);
      toast.error(error.message || "Failed to parse file");
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleImport = async () => {
    if (!validationResult?.valid.length) return;

    setImporting(true);

    try {
      // Check for duplicate emails in the database
      const emails = validationResult.valid.map(c => c.email);
      const { data: existingClients } = await supabase
        .from('clients')
        .select('email')
        .eq('agent_id', agentId)
        .in('email', emails);

      const existingEmails = new Set(existingClients?.map(c => c.email) || []);
      
      // Filter out duplicates
      const newClients = validationResult.valid.filter(c => !existingEmails.has(c.email));

      if (newClients.length === 0) {
        toast.error("All clients already exist in your database");
        return;
      }

      // Insert new clients
      const { error } = await supabase
        .from('clients')
        .insert(
          newClients.map(client => ({
            agent_id: agentId,
            first_name: client.first_name,
            last_name: client.last_name,
            email: client.email,
            phone: client.phone || null,
            client_type: client.client_type || null,
          }))
        );

      if (error) throw error;

      const skipped = validationResult.valid.length - newClients.length;
      
      toast.success(
        `Successfully imported ${newClients.length} client(s)` +
        (skipped > 0 ? `. Skipped ${skipped} duplicate(s)` : '')
      );
      
      onImportComplete();
      onOpenChange(false);
      setValidationResult(null);
    } catch (error: any) {
      console.error("Error importing clients:", error);
      toast.error("Failed to import clients");
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    setValidationResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Clients from File</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing your client contacts. File must include First Name, Last Name, and Email columns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          {!validationResult && (
            <div className="space-y-4">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">CSV Format Requirements:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li><strong>Required columns:</strong> First Name, Last Name, Email</li>
                      <li><strong>Optional columns:</strong> Phone, Notes</li>
                      <li>First row must be column headers</li>
                      <li>Maximum file size: 20MB</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 hover:border-primary transition-colors">
                <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-sm font-medium text-primary hover:underline">
                    Click to upload
                  </span>
                  <span className="text-sm text-muted-foreground"> or drag and drop</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-2">CSV files only</p>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </div>

              {uploading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Processing file...</span>
                </div>
              )}
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <div className="space-y-4">
              {/* Success Count */}
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <strong>{validationResult.valid.length} valid client(s)</strong> ready to import
                </AlertDescription>
              </Alert>

              {/* Errors */}
              {validationResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">{validationResult.errors.length} row(s) with errors (will be skipped):</p>
                      <div className="max-h-40 overflow-y-auto space-y-2 text-sm">
                        {validationResult.errors.slice(0, 10).map((error, idx) => (
                          <div key={idx} className="border-l-2 border-destructive pl-2">
                            <p className="font-medium">Row {error.row}:</p>
                            <ul className="list-disc list-inside ml-2">
                              {error.errors.map((err, errIdx) => (
                                <li key={errIdx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        {validationResult.errors.length > 10 && (
                          <p className="text-xs text-muted-foreground">
                            ...and {validationResult.errors.length - 10} more error(s)
                          </p>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview */}
              {validationResult.valid.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Preview (first 5 clients):</Label>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResult.valid.slice(0, 5).map((client, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{client.first_name} {client.last_name}</td>
                            <td className="p-2">{client.email}</td>
                            <td className="p-2">{client.phone || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCancel} disabled={importing}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || validationResult.valid.length === 0}
                >
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import {validationResult.valid.length} Client(s)
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
