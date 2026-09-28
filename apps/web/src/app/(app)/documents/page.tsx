"use client";

import { useTRPC } from "@flos/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, EmptyState, ErrorText, PageHeader, Select } from "@/components/ui";
import { useFamily } from "@/lib/hooks";

const FOLDERS = ["General", "Medical", "School", "Insurance", "IDs", "Travel"];

export default function DocumentsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isParent } = useFamily();
  const [folder, setFolder] = useState("");
  const [uploadFolder, setUploadFolder] = useState("General");
  const [teensCanSee, setTeensCanSee] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const docs = useQuery(trpc.documents.list.queryOptions({ folder: folder || undefined }));
  const requestUpload = useMutation(trpc.documents.requestUpload.mutationOptions());
  const remove = useMutation(
    trpc.documents.delete.mutationOptions({ onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.documents.pathKey() }) }),
  );

  const onFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      // 1) API creates the record and a presigned URL, 2) browser PUTs straight to R2.
      const { uploadUrl } = await requestUpload.mutateAsync({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        folder: uploadFolder,
        visibleTo: teensCanSee ? ["ADMIN_PARENT", "PARENT", "TEEN"] : ["ADMIN_PARENT", "PARENT"],
      });
      const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!res.ok) throw new Error("Upload failed");
      await queryClient.invalidateQueries({ queryKey: trpc.documents.pathKey() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const open = async (id: string) => {
    const { url } = await queryClient.fetchQuery(trpc.documents.getDownloadUrl.queryOptions({ id }));
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Shared documents" subtitle="Insurance cards, school forms, medical records - encrypted at rest on Cloudflare R2" />
      {isParent && (
        <Card className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)} className="w-40">
            {FOLDERS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={teensCanSee} onChange={(e) => setTeensCanSee(e.target.checked)} /> Teens can see
          </label>
          <label className="ml-auto">
            <input type="file" className="hidden" accept="application/pdf,image/*,text/plain" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <span className="inline-flex cursor-pointer rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white">
              {uploading ? "Uploading…" : "Upload file"}
            </span>
          </label>
        </Card>
      )}
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <ErrorText error={requestUpload.error} />

      <div className="mb-3 flex gap-2">
        {["", ...FOLDERS].map((f) => (
          <Button key={f} variant={folder === f ? "primary" : "ghost"} onClick={() => setFolder(f)}>
            {f || "All"}
          </Button>
        ))}
      </div>
      {docs.data?.length === 0 ? (
        <EmptyState title="No documents here yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100 dark:divide-slate-800">
            {docs.data?.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2">
                <span>{d.mimeType === "application/pdf" ? "📄" : "🖼️"}</span>
                <button className="flex-1 text-left font-medium hover:underline" onClick={() => open(d.id)}>{d.name}</button>
                <span className="text-xs text-ink-500">{d.folder} · {(d.sizeBytes / 1024).toFixed(0)} KB</span>
                {isParent && <button className="text-sm text-ink-500 hover:text-danger" onClick={() => remove.mutate({ id: d.id })}>Delete</button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
