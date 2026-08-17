import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDeveloperEditor } from "@/components/developments/DeveloperDevelopmentLayout";
import { formatDateLabel } from "@/lib/developments/format";
import { deleteUpdate, upsertUpdate } from "@/lib/developments/workspace";
import { toast } from "sonner";

export default function DeveloperUpdatesPage() {
  const { development, canEdit, bundle, reload } = useDeveloperEditor();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("general");
  const [publishNow, setPublishNow] = useState(true);
  const [saving, setSaving] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !title.trim() || !body.trim()) return;
    setSaving(true);
    const { error } = await upsertUpdate({
      development_id: development.id,
      account_id: development.account_id,
      title: title.trim(),
      body_markdown: body.trim(),
      kind,
      is_published: publishNow,
      published_at: publishNow ? new Date().toISOString() : null,
      posted_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setTitle("");
    setBody("");
    toast.success("Update created.");
    await reload();
  };

  const onDelete = async (id: string) => {
    const { error } = await deleteUpdate(id);
    if (error) toast.error(error);
    else {
      toast.success("Update removed.");
      await reload();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Updates</h2>
        <p className="text-sm text-zinc-500">Project news visible on the agent mini-site when published.</p>
      </div>

      {canEdit ? (
        <form onSubmit={onCreate} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Kind</Label>
            <Input value={kind} onChange={(e) => setKind(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Body (markdown)</Label>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
            />
            Publish immediately
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add update"}
          </Button>
        </form>
      ) : null}

      <ul className="space-y-3">
        {bundle.updates.length === 0 ? (
          <li className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
            No updates yet.
          </li>
        ) : (
          bundle.updates.map((update) => (
            <li key={update.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-900">{update.title}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDateLabel(update.posted_at)} · {update.is_published ? "Published" : "Draft"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{update.body_markdown}</p>
                </div>
                {canEdit ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => void onDelete(update.id)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
