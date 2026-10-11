"use client";

/**
 * Up to 5 photos for an inquiry (§10.7): drop zone + file input, client compression, upload to
 * Convex storage right away (so submit is instant), thumbnails with remove buttons.
 */
import { useMutation } from "convex/react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { CameraIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/cn";
import { checkPhoto, compressPhoto, PHOTO_ACCEPT } from "@/lib/images/compress";
import { formatNumber } from "@/lib/format/number";
import { convexErrorMessage, ERRORS } from "@/lib/i18n/sr/shop";
import { Spinner } from "@/components/ui/Spinner";
import { TEST_IDS } from "@/constants/testIds";

export type PhotoItem = {
  id: string;
  name: string;
  preview: string;
  status: "uploading" | "done" | "error";
  storageId?: Id<"_storage">;
  error?: string;
};

const MAX = 5;

export function PhotoPicker({
  photos,
  onChange,
}: {
  photos: PhotoItem[];
  onChange: (update: (prev: PhotoItem[]) => PhotoItem[]) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.inquiries.generateUploadUrl);
  const [notice, setNotice] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  useEffect(
    () => () => {
      for (const p of photos) URL.revokeObjectURL(p.preview);
    },
    // Revoke previews only when the picker unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const upload = async (item: PhotoItem, file: File) => {
    try {
      const blob = await compressPhoto(file);
      const url = await generateUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": blob.type || file.type },
        body: blob,
      });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      onChange((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: "done", storageId } : p)),
      );
    } catch (error) {
      onChange((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? { ...p, status: "error", error: convexErrorMessage(error, ERRORS.upload) }
            : p,
        ),
      );
    }
  };

  const add = (files: FileList | File[]) => {
    setNotice(null);
    const list = [...files];
    const room = MAX - photos.length;
    if (room <= 0) {
      setNotice("Najviše 5 fotografija.");
      return;
    }
    const accepted: { item: PhotoItem; file: File }[] = [];
    // Each rejected file is named with its own reason (FLOW-27).
    const rejected: string[] = [];
    for (const file of list.slice(0, room)) {
      const check = checkPhoto(file);
      if (!check.ok) {
        rejected.push(
          check.reason === "type"
            ? ERRORS.uploadType(file.name)
            : ERRORS.uploadSize(
                file.name,
                formatNumber(file.size / (1024 * 1024), { decimals: 1 }),
              ),
        );
        continue;
      }
      accepted.push({
        file,
        item: {
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          preview: URL.createObjectURL(file),
          status: "uploading",
        },
      });
    }
    if (list.length > room) rejected.push("Najviše 5 fotografija — višak nije dodat.");
    if (rejected.length) setNotice(rejected.join(" "));
    if (!accepted.length) return;
    onChange((prev) => [...prev, ...accepted.map((a) => a.item)]);
    for (const a of accepted) void upload(a.item, a.file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (event.dataTransfer.files.length) add(event.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-control",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
          over
            ? "border-accent bg-accent-subtle"
            : "border-control bg-surface-1 hover:border-ink-3",
        )}
      >
        <CameraIcon size={28} aria-hidden="true" className="text-ink-3" />
        <span className="type-body-s font-semibold text-ink-1">Dodaj fotografiju</span>
        <span className="type-caption font-normal text-ink-3">
          Stari deo, pločica sa brojem ili saobraćajna · do 5 · JPG, PNG, WebP do 8 MB
        </span>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={PHOTO_ACCEPT.join(",")}
          multiple
          data-testid={TEST_IDS.inquiryPhotoInput}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {notice ? (
        <p className="flex items-start gap-1.5 type-caption text-warning" role="status">
          <WarningCircleIcon size={16} aria-hidden="true" className="mt-px shrink-0" />
          {notice}
        </p>
      ) : null}
      {photos.length ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5" aria-label="Dodate fotografije">
          {photos.map((p) => (
            <li
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-sm border border-line bg-surface-2"
              data-status={p.status}
              data-testid="inquiry-photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={p.preview} alt={p.name} className="h-full w-full object-cover" />
              {p.status === "uploading" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-bg/60">
                  <Spinner label="Otprema se" />
                </span>
              ) : null}
              {p.status === "error" ? (
                <span className="absolute inset-x-0 bottom-0 bg-danger-subtle px-1.5 py-1 type-caption-s text-danger">
                  {p.error}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`Ukloni fotografiju ${p.name}`}
                onClick={() => {
                  URL.revokeObjectURL(p.preview);
                  onChange((prev) => prev.filter((x) => x.id !== p.id));
                }}
                className="absolute top-1 right-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-xs bg-bg/80 text-ink-1 transition-control hover:bg-surface-3"
              >
                <XIcon size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
