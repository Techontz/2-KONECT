"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

const MAX_BYTES = 4 * 1024 * 1024;

export interface PickedImage {
  /** Stable key so React does not remount a tile when the order changes. */
  id: string;
  file: File;
  preview: string;
}

/**
 * Product photo manager.
 *
 * Sellers photograph stock on a phone in a shop, so the two things that
 * matter are seeing what you just captured and being able to fix the order.
 * The first image is the one shoppers see on every card, so it is marked and
 * movable rather than being whichever file the picker happened to sort first.
 *
 * Object URLs are revoked as tiles go away — without that, photographing a
 * dozen items in one session leaks every preview.
 */
export function ProductImagePicker({
  images,
  onChange,
  max = 10,
}: {
  images: PickedImage[];
  onChange(next: PickedImage[]): void;
  max?: number;
}) {
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Release previews for tiles that are no longer rendered.
  const known = useRef(new Set<string>());
  useEffect(() => {
    const current = new Set(images.map((image) => image.preview));
    known.current.forEach((url) => {
      if (!current.has(url)) URL.revokeObjectURL(url);
    });
    known.current = current;
  }, [images]);

  useEffect(() => () => known.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function accept(list: FileList | null) {
    if (!list?.length) return;

    const problems: string[] = [];
    const accepted: PickedImage[] = [];

    Array.from(list).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        problems.push(t("productForm.wrongType", { name: file.name }));
        return;
      }
      if (file.size > MAX_BYTES) {
        problems.push(t("productForm.tooLarge", { name: file.name }));
        return;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
      });
    });

    setWarning(problems[0] ?? null);
    if (accepted.length) onChange([...images, ...accepted].slice(0, max));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function makePrimary(index: number) {
    if (index === 0) return;
    const next = [...images];
    const [picked] = next.splice(index, 1);
    onChange([picked, ...next]);
  }

  function remove(index: number) {
    onChange(images.filter((_, position) => position !== index));
  }

  const full = images.length >= max;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`group relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-white ${
              index === 0
                ? "ring-2 ring-[color:var(--color-brand)]"
                : "ring-1 ring-[color:var(--color-line)]"
            }`}
          >
            <img src={image.preview} alt="" className="h-full w-full object-contain p-1" />

            {index === 0 ? (
              <span className="absolute left-1 top-1 rounded-[var(--radius-xs)] bg-[color:var(--color-brand)] px-1.5 py-[1px] text-[9px] font-black uppercase text-white">
                {t("productForm.primary")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makePrimary(index)}
                title={t("productForm.makePrimary")}
                aria-label={t("productForm.makePrimary")}
                className="absolute left-1 top-1 rounded-[var(--radius-xs)] bg-black/55 px-1.5 py-[1px] text-[9px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                ★
              </button>
            )}

            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={t("productForm.removePhoto")}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-[13px] font-bold text-white"
            >
              ×
            </button>

            {/* Buttons rather than drag: reliable with a thumb, and reachable
                by keyboard. */}
            <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={t("productForm.moveLeft")}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-30"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === images.length - 1}
                aria-label={t("productForm.moveRight")}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>
        ))}

        {!full ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border-2 border-dashed border-[color:var(--color-line-strong)] text-[color:var(--color-ink-muted)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
          >
            <span className="text-[22px] leading-none">+</span>
            <span className="text-[11px] font-bold">{t("productForm.addPhotos")}</span>
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={full}
          className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[13px] font-bold disabled:opacity-40"
        >
          {t("productForm.addPhotos")}
        </button>

        {/* `capture` opens the camera on a handset and is ignored on desktop,
            where this simply behaves as a second file picker. */}
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          disabled={full}
          className="h-9 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[13px] font-bold disabled:opacity-40"
        >
          📷 {t("productForm.takePhoto")}
        </button>

        <span className="self-center text-[11px] text-[color:var(--color-ink-faint)]">
          {images.length}/{max}
        </span>
      </div>

      <p className="mt-1.5 text-[11px] text-[color:var(--color-ink-muted)]">
        {t("productForm.photoHint")}
      </p>

      {warning ? (
        <p role="alert" className="mt-1 text-[11px] font-semibold text-[color:var(--color-sale)]">
          {warning}
        </p>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          accept(event.target.files);
          // Reset so re-picking the same file still fires a change.
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
