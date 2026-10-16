"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { removeStudentPhoto, uploadStudentPhoto } from "@/app/(app)/students/actions";
import { Avatar } from "@/components/ui";

/** Shrinks a photo to at most `max` px on its longer side and re-encodes it as JPEG. */
export async function shrink(file: File, max = 480): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read the photo."))), "image/jpeg", 0.85));
}

export function PhotoUploader({ rollNo, name, photoUrl, editable }: { rollNo: string; name: string; photoUrl: string | null; editable: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!editable) return <Avatar name={name} photoUrl={photoUrl} size="lg" />;
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative rounded-2xl focus-visible:outline-2 focus-visible:outline-accent"
        aria-label={photoUrl ? "Change photo" : "Add photo"}
        disabled={pending}
      >
        <Avatar name={name} photoUrl={photoUrl} size="lg" />
        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(null);
          start(async () => {
            try {
              const fd = new FormData();
              fd.append("photo", new File([await shrink(file)], "photo.jpg", { type: "image/jpeg" }));
              const res = await uploadStudentPhoto(rollNo, fd);
              if (!res?.ok) setError(res?.message ?? "Upload failed.");
            } catch {
              setError("Couldn't read that photo. Try another one.");
            }
          });
        }}
      />
      <div className="flex items-center gap-2 text-[12px]">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={pending} className="font-medium text-accent-ink hover:underline">
          {photoUrl ? "Change photo" : "Add photo"}
        </button>
        {photoUrl && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => void (await removeStudentPhoto(rollNo)))}
            className="text-muted hover:text-danger-ink"
            aria-label="Remove photo"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {error && <p className="max-w-32 text-center text-[12px] text-danger-ink">{error}</p>}
    </div>
  );
}
