"use client";

/**
 * Product images (DESIGN-SYSTEM §10.12): drag-and-drop or pick files (JPG, PNG, WebP, AVIF,
 * ≤ 10 MB, ≤ 12 per product), upload straight to Convex storage, reorder by dragging or with
 * the arrow buttons (keyboard), remove with confirmation. The first image is the main one.
 */
import { useMutation } from "convex/react";
import { useRef, useState, type DragEvent } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/cn";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toast";

import { ConfirmDialog, useConfirm } from "../ConfirmDialog";

export type EditorImage = {
  storageId: Id<"_storage">;
  alt: string;
  url: string | null;
  width: number;
  height: number;
};

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 12;

async function dimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

export function ImagesEditor({
  productId,
  productName,
  images,
}: {
  productId: Id<"products">;
  productName: string;
  images: EditorImage[];
}) {
  const uploadUrl = useMutation(api.catalog.productsAdmin.generateImageUploadUrl);
  const attach = useMutation(api.catalog.productsAdmin.attachImage);
  const reorder = useMutation(api.catalog.productsAdmin.reorderImages);
  const remove = useMutation(api.catalog.productsAdmin.removeImage);
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const upload = async (files: FileList | File[]) => {
    const list = [...files];
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return toast.error(`Artikal već ima ${MAX_IMAGES} slika.`);
    for (const file of list.slice(0, room)) {
      if (!TYPES.includes(file.type)) {
        toast.error(`${file.name}: dozvoljene su slike JPG, PNG, WebP ili AVIF.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: slika je veća od 10 MB.`);
        continue;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const { width, height } = await dimensions(file);
        const url = await uploadUrl({});
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error("upload");
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        await attach({ productId, storageId, alt: productName.slice(0, 160), width, height });
      } catch (err) {
        toast.error(`${file.name}: ${convexErrorMessage(err, "slika nije otpremljena.")}`);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    if (list.length > room)
      toast.warning(`Dodato je samo ${room} slika — najviše ${MAX_IMAGES} po artiklu.`);
  };

  const move = async (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const order = images.map((i) => i.storageId);
    const [item] = order.splice(from, 1);
    order.splice(to, 0, item!);
    try {
      await reorder({ productId, storageIds: order });
    } catch (err) {
      toast.error(convexErrorMessage(err, "Redosled nije sačuvan."));
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 ? (
        <ol
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          aria-label="Slike artikla"
        >
          {images.map((img, i) => (
            <li
              key={img.storageId}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragIndex !== null) void move(dragIndex, i);
                setDragIndex(null);
              }}
              className={cn(
                "group flex cursor-grab flex-col overflow-hidden rounded-sm border bg-surface-1 active:cursor-grabbing",
                dragIndex === i ? "border-focus opacity-60" : "border-line",
              )}
            >
              <div className="relative aspect-[4/3] bg-surface-2">
                {img.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Convex storage URL in the editor
                  <img src={img.url} alt={img.alt} className="size-full object-contain" />
                ) : null}
                {i === 0 ? (
                  <span className="absolute left-2 top-2 rounded-xs bg-ink-1 px-1.5 py-0.5 type-label text-bg-raised">
                    Glavna
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 border-t border-line-faint px-1.5 py-1">
                <span className="truncate px-1 type-caption text-ink-3" title={img.alt}>
                  {img.width} × {img.height}
                </span>
                <span className="flex">
                  <IconButton
                    label={`Pomeri sliku ${i + 1} levo`}
                    icon={<ArrowLeftIcon size={14} />}
                    size="sm"
                    disabled={i === 0}
                    onClick={() => void move(i, i - 1)}
                  />
                  <IconButton
                    label={`Pomeri sliku ${i + 1} desno`}
                    icon={<ArrowRightIcon size={14} />}
                    size="sm"
                    disabled={i === images.length - 1}
                    onClick={() => void move(i, i + 1)}
                  />
                  <IconButton
                    label={`Ukloni sliku ${i + 1}`}
                    icon={<TrashIcon size={14} />}
                    size="sm"
                    onClick={() =>
                      confirm.ask({
                        title: "Ukloniti sliku?",
                        description:
                          "Slika se briše iz skladišta. Ova radnja se ne može poništiti.",
                        confirmLabel: "Ukloni sliku",
                        danger: true,
                        onConfirm: () => remove({ productId, storageId: img.storageId }),
                      })
                    }
                  />
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          if (e.dataTransfer.types.includes("Files")) setOver(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed px-4 py-8 text-center transition-control",
          over ? "border-focus bg-accent-subtle" : "border-line-strong bg-surface-2",
        )}
      >
        <UploadSimpleIcon size={28} className="text-ink-3" aria-hidden="true" />
        <p className="type-body-s text-ink-2">Prevucite slike ovde ili</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => input.current?.click()}
          disabled={images.length >= MAX_IMAGES}
        >
          Izaberite slike
        </Button>
        <p className="type-caption text-ink-3">
          JPG, PNG, WebP ili AVIF · do 10 MB · najviše {MAX_IMAGES} slika · prva je glavna
        </p>
        <input
          ref={input}
          type="file"
          accept={TYPES.join(",")}
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Izaberite slike artikla"
          data-testid="admin-product-image-input"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading.length > 0 ? (
          <p className="flex items-center gap-2 type-caption text-ink-2" role="status">
            <Spinner size={16} /> Otprema se: {uploading.join(", ")}
          </p>
        ) : null}
      </div>
      <ConfirmDialog {...confirm.props} />
    </div>
  );
}
