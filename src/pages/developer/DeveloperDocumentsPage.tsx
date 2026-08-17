import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentRow } from "@/components/developments/DocumentRow";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import { AGENT_RESOURCE_CATEGORIES, documentCategoryLabel } from "@/lib/developments/format";
import { deleteDocument, uploadDevelopmentDocumentFile } from "@/lib/developments/workspace";
import { toast } from "sonner";

const CATEGORIES = [
  "brochure",
  "floor_plan",
  "site_plan",
  "spec_sheet",
  "disclosure",
  "condo_docs",
  "buyer_agent_compensation",
  "other",
] as const;

export default function DeveloperDocumentsPage() {
  const { development, canEdit, bundle, reload } = useDeveloperEditor();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("brochure");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !file || !title.trim()) return;
    setSaving(true);
    const { error } = await uploadDevelopmentDocumentFile({
      developmentId: development.id,
      accountId: development.account_id,
      file,
      title: title.trim(),
      category,
      access: AGENT_RESOURCE_CATEGORIES.has(category) ? "agent_only" : "agent_only",
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setTitle("");
    setFile(null);
    toast.success("Document uploaded.");
    await reload();
  };

  const onDelete = async (id: string) => {
    const { error } = await deleteDocument(id);
    if (error) toast.error(error);
    else {
      toast.success("Document removed.");
      await reload();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Documents</h2>
        <p className="text-sm text-zinc-500">
          Private storage only — agents open files through signed URLs.
        </p>
      </div>

      {canEdit ? (
        <form onSubmit={onUpload} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {documentCategoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>File</Label>
            <Input
              type="file"
              accept=".pdf,image/*,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div>
            <Button type="submit" disabled={saving || !file}>
              {saving ? "Uploading…" : "Upload document"}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        {bundle.documents.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
            No documents yet.
          </p>
        ) : (
          bundle.documents.map((doc) => (
            <div key={doc.id} className="space-y-2">
              <DocumentRow document={doc} />
              {canEdit ? (
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => void onDelete(doc.id)}>
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
