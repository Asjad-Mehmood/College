"use client";

import { useRef, useState, useTransition } from "react";
import { Download, Eye, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { Button, Input, cx } from "@/components/ui";
import { deleteViolationFile, uploadViolationFile } from "../actions";

export type AttachmentInfo = {
  id: number;
  fileName: string;
  mimeType: string;
  size: number;
  note: string | null;
  uploadedBy: string;
  createdAt: string;
};

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*";

function kb(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function Attachments({ caseId, files, manage }: { caseId: number; files: AttachmentInfo[]; manage: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {files.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
          No documents yet. Upload the student&apos;s application, an undertaking or a parent letter.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {files.map((f) => {
            const Icon = f.mimeType.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={f.fileName}>
                    {f.fileName}
                  </p>
                  <p className="truncate text-[12px] text-muted">
                    {kb(f.size)} · {f.uploadedBy} · {f.createdAt}
                    {f.note && ` · ${f.note}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <a href={`/api/violation-files/${f.id}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label={`View ${f.fileName}`} title="View">
                    <Eye className="size-4" />
                  </a>
                  <a href={`/api/violation-files/${f.id}?download`} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2" aria-label={`Download ${f.fileName}`} title="Download">
                    <Download className="size-4" />
                  </a>
                  {manage &&
                    (confirm === f.id ? (
                      <span className="flex items-center gap-1 text-[12px]">
                        <button type="button" disabled={pending} onClick={() => start(async () => { await deleteViolationFile(f.id); setConfirm(null); })} className="rounded-md bg-critical/10 px-2 py-1 font-medium text-danger-ink">
                          Remove
                        </button>
                        <button type="button" onClick={() => setConfirm(null)} className="px-1 text-muted">
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirm(f.id)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-danger-ink" aria-label={`Remove ${f.fileName}`} title="Remove">
                        <Trash2 className="size-4" />
                      </button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {manage && (
        <form
          ref={formRef}
          className="flex flex-col gap-2 rounded-xl bg-surface-2/50 p-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            start(async () => {
              const res = await uploadViolationFile(caseId, fd);
              if (!res.ok) setError(res.error ?? "Upload failed.");
              else formRef.current?.reset();
            });
          }}
        >
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink-2 hover:border-line-strong">
            <Paperclip className="size-4 shrink-0" aria-hidden />
            <input type="file" name="file" required accept={ACCEPT} className="min-w-0 flex-1 text-[13px] file:mr-2 file:rounded-md file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-[13px] file:font-medium file:text-ink" aria-label="Document to upload" />
          </label>
          <Input name="note" maxLength={200} placeholder="Note (optional), e.g. Student's apology application" className="sm:max-w-64" aria-label="Note" />
          <Button type="submit" variant="primary" disabled={pending}>
            <Upload className="size-4" aria-hidden /> {pending ? "Uploading…" : "Upload"}
          </Button>
        </form>
      )}
      {error && <p className={cx("text-[13px] text-danger-ink")}>{error}</p>}
      {manage && <p className="text-[12px] text-muted">PDF, photo or Word file, up to 3.5 MB.</p>}
    </div>
  );
}
