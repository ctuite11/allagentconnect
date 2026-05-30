import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  if (headerLine.includes(";") && !headerLine.includes(",")) return ";";
  return ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  const normCandidates = candidates.map(normalizeHeader);
  return headers.findIndex((header) => normCandidates.includes(header));
}

const clientRowSchema = z.object({
  first_name: z.string().trim().max(100).optional().or(z.literal("")),
  last_name: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  client_type: z.enum(['buyer', 'seller', 'renter', 'agent', 'lender', 'attorney', 'inspector', 'other']).nullable().optional(),
  office_id: z.string().trim().max(64).nullable().optional(),
}).refine(
  (data) => (data.first_name && data.first_name.length > 0) || (data.last_name && data.last_name.length > 0),
  { message: "At least a first or last name is required", path: ["first_name"] }
);

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
  office_id?: string | null;
}

interface ValidationResult {
  valid: ParsedClient[];
  errors: Array<{ row: number; errors: string[] }>;
}

export function ImportClientsDialog({ open, onOpenChange, agentId, onImportComplete }: ImportClientsDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);

  const parseCSV = (text: string): ParsedClient[] => {
    // Strip UTF-8 BOM
    text = text.replace(/^\uFEFF/, "");

    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const delimiter = detectDelimiter(lines[0]);
    const rawHeader = parseCsvLine(lines[0], delimiter);
    const header = rawHeader.map(normalizeHeader);

    const firstNameIdx = findHeaderIndex(header, ['first name', 'firstname', 'first', 'given name', 'given', 'fname', 'f name']);
    const lastNameIdx = findHeaderIndex(header, ['last name', 'lastname', 'last', 'surname', 'family name', 'family', 'lname', 'l name']);
    const emailIdx = findHeaderIndex(header, ['email', 'e mail', 'email address']);
    const phoneIdx = findHeaderIndex(header, ['phone', 'telephone', 'mobile', 'phone number', 'mobile number', 'cell', 'cell phone']);
    const clientTypeIdx = header.findIndex(h => h.includes('client') && h.includes('type'));
    const officeIdIdx = findHeaderIndex(header, ['office id', 'office', 'mls office id', 'mls office']);
    const fullNameIdx = findHeaderIndex(header, ['name', 'full name', 'fullname', 'contact name', 'client name']);

    const hasAnyName = firstNameIdx !== -1 || lastNameIdx !== -1;
    const hasFullName = fullNameIdx !== -1;

    if (!hasAnyName && !hasFullName) {
      throw new Error(
        `CSV must include 'First Name' (and/or 'Last Name') or a 'Full Name' column. Detected headers: ${rawHeader.join(', ') || '(none)'}`
      );
    }
    if (emailIdx === -1) {
      throw new Error(
        `CSV must include an 'Email' column. Detected headers: ${rawHeader.join(', ') || '(none)'}`
      );
    }

    const clients: ParsedClient[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i], delimiter);
      
      if (values.length < 2) continue;

      let firstName = '';
      let lastName = '';

      firstName = firstNameIdx !== -1 ? (values[firstNameIdx] || '').trim() : '';
      lastName = lastNameIdx !== -1 ? (values[lastNameIdx] || '').trim() : '';

      // Per-row fallback: if first/last empty (or columns missing) but a full-name
      // column has a value, split it. Handles mixed CSVs where some rows only fill Name.
      if (!firstName && !lastName && hasFullName) {
        const fullName = (values[fullNameIdx] || '').trim().replace(/\s+/g, ' ');
        if (fullName) {
          const parts = fullName.split(/\s+/);
          firstName = parts[0] || '';
          lastName = parts.slice(1).join(' ');
        }
      }

      // Skip blank rows entirely (no name and no email).
      if (!firstName && !lastName && !(values[emailIdx] || '').trim()) continue;

      const rawClientType = clientTypeIdx !== -1 ? values[clientTypeIdx] : '';
      const normalizedClientType = rawClientType?.trim()
        ? rawClientType.trim().toLowerCase()
        : null;

      const rawOfficeId = officeIdIdx !== -1 ? values[officeIdIdx] : '';
      const normalizedOfficeId = rawOfficeId?.trim() ? rawOfficeId.trim() : null;

      clients.push({
        first_name: firstName,
        last_name: lastName,
        email: (values[emailIdx] || '').trim().toLowerCase(),
        phone: phoneIdx !== -1 ? values[phoneIdx] : '',
        client_type: normalizedClientType,
        office_id: normalizedOfficeId,
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
          last_name: result.data.last_name ?? '',
          email: result.data.email,
          phone: result.data.phone,
          client_type: result.data.client_type,
          office_id: result.data.office_id ?? null,
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

    if (!agentId) {
      toast.error("Please wait a moment and try importing again.");
      return;
    }

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
    if (!agentId) {
      toast.error("Please wait a moment and try importing again.");
      return;
    }

    if (!validationResult?.valid.length) return;

    setImporting(true);
    setImportProgress("Checking for duplicates...");

    try {
      // Dedupe within the parsed file (case-insensitive), keep first occurrence.
      const seenInFile = new Set<string>();
      const uniqueInFile: ParsedClient[] = [];
      let inFileDupCount = 0;
      for (const c of validationResult.valid) {
        const key = c.email.trim().toLowerCase();
        if (seenInFile.has(key)) {
          inFileDupCount++;
          continue;
        }
        seenInFile.add(key);
        uniqueInFile.push({ ...c, email: key });
      }
      const emails = uniqueInFile.map(c => c.email);

      // 1) Batched duplicate-email lookup (chunks of 200) to avoid huge IN()
      // lists and the 1000-row default return cap.
      const DEDUPE_CHUNK = 200;
      const existingEmails = new Set<string>();
      for (let i = 0; i < emails.length; i += DEDUPE_CHUNK) {
        const chunk = emails.slice(i, i + DEDUPE_CHUNK);
        const { data, error } = await supabase
          .from('clients')
          .select('email')
          .eq('agent_id', agentId)
          .or(chunk.map(e => `email.ilike.${e}`).join(','));
        if (error) throw error;
        data?.forEach((c: { email: string }) =>
          existingEmails.add((c.email || '').trim().toLowerCase())
        );
      }

      // 2) AAC-registered check with bounded concurrency (max 10 in-flight)
      // instead of firing all 1000+ RPCs at once.
      setImportProgress("Checking AAC registrations...");
      const aacRegistered = new Set<string>();
      const RPC_CONCURRENCY = 10;
      let cursor = 0;
      const checkOne = async (em: string) => {
        try {
          const { data } = await supabase.rpc(
            "is_email_registered_with_aac" as any,
            { p_email: em }
          );
          if (data === true) aacRegistered.add(em.toLowerCase());
        } catch (err) {
          console.warn("AAC registration check failed for", em, err);
        }
      };
      const workers = Array.from(
        { length: Math.min(RPC_CONCURRENCY, emails.length) },
        async () => {
          while (true) {
            const idx = cursor++;
            if (idx >= emails.length) return;
            await checkOne(emails[idx]);
            if (idx % 50 === 0) {
              setImportProgress(
                `Checking AAC registrations... ${Math.min(idx + 1, emails.length)} / ${emails.length}`
              );
            }
          }
        }
      );
      await Promise.all(workers);

      // Filter out duplicates and AAC-registered emails
      const newClients = uniqueInFile.filter(
        (c) => !existingEmails.has(c.email) && !aacRegistered.has(c.email.toLowerCase())
      );

      const aacSkipped = uniqueInFile.filter((c) =>
        aacRegistered.has(c.email.toLowerCase())
      ).length;

      if (newClients.length === 0) {
        if (aacSkipped > 0) {
          toast.error(
            `${aacSkipped} email(s) are already registered with AAC and were skipped. No new clients to import.`
          );
          return;
        }
        toast.error("All clients already exist in your database");
        return;
      }

      // 3) Batched insert (chunks of 500) so a single big payload doesn't
      // exceed Supabase request limits or time out. Continue on per-batch failure.
      const INSERT_CHUNK = 500;
      const rows = newClients.map(client => ({
        agent_id: agentId,
        first_name: client.first_name,
        last_name: client.last_name || '',
        email: client.email,
        phone: client.phone || null,
        client_type: client.client_type || null,
        office_id: client.office_id || null,
      }));

      let insertedCount = 0;
      let failedCount = 0;
      let raceDupSkipped = 0;
      const batchErrors: string[] = [];
      const totalBatches = Math.ceil(rows.length / INSERT_CHUNK);

      for (let b = 0; b < totalBatches; b++) {
        const batch = rows.slice(b * INSERT_CHUNK, (b + 1) * INSERT_CHUNK);
        setImportProgress(
          `Importing ${insertedCount + batch.length} / ${rows.length}...`
        );
        const { error } = await supabase.from('clients').insert(batch);
        if (!error) {
          insertedCount += batch.length;
          continue;
        }
        // Fall back to per-row inserts: silently skip unique-violation duplicates
        // (race condition vs. the new partial unique index on (agent_id, lower(email))).
        console.warn("Batch insert failed, retrying row-by-row", b + 1, error);
        for (const row of batch) {
          const { error: rowErr } = await supabase.from('clients').insert(row);
          if (!rowErr) {
            insertedCount++;
          } else if (rowErr.code === '23505') {
            raceDupSkipped++;
          } else {
            failedCount++;
            batchErrors.push(rowErr.message);
            console.error("Row insert failed", row.email, rowErr);
          }
        }
      }

      const dbDupSkipped =
        uniqueInFile.length - newClients.length - aacSkipped + raceDupSkipped;

      if (insertedCount === 0) {
        toast.error(
          `Import failed. ${batchErrors[0] ?? "No clients were imported."}`
        );
      } else {
        toast.success(
          `Imported ${insertedCount} client(s)` +
            (dbDupSkipped > 0 ? `. Skipped ${dbDupSkipped} already in your list` : '') +
            (inFileDupCount > 0 ? `. Skipped ${inFileDupCount} duplicate(s) in file` : '') +
            (aacSkipped > 0 ? `. Skipped ${aacSkipped} already registered with AAC` : '') +
            (failedCount > 0 ? `. ${failedCount} failed` : '')
        );
      }
      
      onImportComplete();
      onOpenChange(false);
      setValidationResult(null);
    } catch (error: any) {
      console.error("Error importing clients:", error);
      toast.error(
        error?.message
          ? `Failed to import clients: ${error.message}`
          : "Failed to import clients"
      );
    } finally {
      setImporting(false);
      setImportProgress(null);
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
            Upload a CSV file containing your client contacts. File must include a Name (or First Name + Last Name) column and Email.
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
                      <li><strong>Required columns:</strong> Name (or First Name + Last Name), Email</li>
                      <li><strong>Optional columns:</strong> Phone, Client Type, Office ID</li>
                      <li>First row must be column headers</li>
                      <li>Maximum file size: 20MB</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 hover:border-neutral-400 transition-colors">
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
                  disabled={uploading || !agentId}
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
                  disabled={importing || !agentId || validationResult.valid.length === 0}
                >
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {importing && importProgress
                    ? importProgress
                    : `Import ${validationResult.valid.length} Client(s)`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
