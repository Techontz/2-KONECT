"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How much the magnifier enlarges, when the source image is big enough. */
const ZOOM = 2.5;
/** Side of the square lens that tracks the cursor, in CSS pixels. */
const LENS = 150;
/** Side of the magnified panel drawn beside the gallery. */
const PANEL = 420;

type Point = { x: number; y: number };

/**
 * Product gallery with desktop hover magnification and a touch viewer.
 *
 * The magnified view is the product photo itself painted at a larger scale —
 * no second asset is fetched and no image is transformed on the server, so
 * what the shopper inspects is exactly what the seller uploaded.
 *
 * Pointer capability decides the interaction rather than screen width: a
 * touchscreen laptop gets the tap-to-open viewer, and hover magnification is
 * never attached to a device that cannot hover.
 */
export function ProductGallery({
  images,
  name,
  activeIndex,
  onSelect,
  children,
}: {
  images: string[];
  name: string;
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Overlay controls (the wishlist heart) drawn on top of the main image. */
  children?: React.ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);

  const [canHover, setCanHover] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [cursor, setCursor] = useState<Point>({ x: 0, y: 0 });
  const [viewerOpen, setViewerOpen] = useState(false);

  // Natural size of the image currently displayed, used to avoid blowing up a
  // photo past its real resolution.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const src = images[activeIndex];

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1280px)");
    const sync = () => setCanHover(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Switching thumbnails must drop everything measured from the previous
  // photo, otherwise the magnifier would keep painting the old image.
  useEffect(() => {
    setNatural(null);
    setHovering(false);
  }, [src]);

  const handleMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, []);

  if (!src) {
    return (
      <div className="mb-3 aspect-square max-h-[560px] w-full rounded-[var(--radius-sm)] bg-[color:var(--color-surface-alt)]" />
    );
  }

  const frame = frameRef.current?.getBoundingClientRect();
  const frameW = frame?.width ?? 0;
  const frameH = frame?.height ?? 0;

  // `object-contain` letterboxes the photo inside the square frame, so the
  // magnifier has to work against the drawn rectangle rather than the frame.
  // Using the frame would stretch anything that is not square.
  const fit = natural && frameW && frameH
    ? Math.min(frameW / natural.w, frameH / natural.h)
    : 0;
  const drawnW = fit ? natural!.w * fit : frameW;
  const drawnH = fit ? natural!.h * fit : frameH;
  const offsetX = (frameW - drawnW) / 2;
  const offsetY = (frameH - drawnH) / 2;

  // Never magnify beyond the file's own pixels — enlarging a small photo past
  // its resolution only shows interpolation, which reads as a broken image.
  const maxScale = drawnW ? (natural?.w ?? 0) / drawnW : ZOOM;
  const scale = Math.min(ZOOM, Math.max(1, maxScale));
  const magnifiable = canHover && natural !== null && scale > 1.2;

  const lens = Math.min(LENS, drawnW || LENS, drawnH || LENS);
  const half = lens / 2;
  // The lens is kept inside the drawn photo so it never frames empty letterbox.
  const lensX = Math.min(Math.max(cursor.x - half, offsetX), offsetX + drawnW - lens);
  const lensY = Math.min(Math.max(cursor.y - half, offsetY), offsetY + drawnH - lens);

  // Where the lens centre falls within the photo itself.
  const pointX = lensX + half - offsetX;
  const pointY = lensY + half - offsetY;

  return (
    <>
      <div className="relative">
        <div
          ref={frameRef}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onMouseMove={handleMove}
          onClick={() => {
            if (!canHover) setViewerOpen(true);
          }}
          className={`relative mx-auto mb-3 aspect-square max-h-[560px] w-full overflow-hidden rounded-[var(--radius-sm)] bg-white ${
            canHover ? "cursor-crosshair" : "cursor-zoom-in"
          }`}
        >
          <img
            key={src}
            src={src}
            alt={`${name} — photo ${activeIndex + 1} of ${images.length}`}
            // The hero image is the page's largest paint — load it eagerly.
            fetchPriority="high"
            onLoad={(event) => {
              const img = event.currentTarget;
              setNatural({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            className="h-full w-full object-contain"
          />

          {magnifiable && hovering ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute border-2 border-[color:var(--color-brand)]"
              style={{
                width: lens,
                height: lens,
                left: lensX,
                top: lensY,
                backgroundColor: "rgba(56, 102, 223, 0.14)",
              }}
            />
          ) : null}

          {children}

          {!canHover ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold text-white"
            >
              Tap to zoom
            </span>
          ) : null}
        </div>

        {/* The magnified panel sits beside the gallery, over the buying column.
            It is only mounted on wide hover-capable viewports, where the grid
            has the room for it — so it can never push the page sideways. */}
        {magnifiable && hovering ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[calc(100%+16px)] top-0 z-30 hidden overflow-hidden rounded-[var(--radius-sm)] bg-white shadow-[var(--shadow-hover)] ring-1 ring-[color:var(--color-line)] xl:block"
            style={{
              width: PANEL,
              height: PANEL,
              backgroundImage: `url("${src}")`,
              backgroundRepeat: "no-repeat",
              backgroundColor: "#fff",
              backgroundSize: `${drawnW * scale}px ${drawnH * scale}px`,
              // Put the point under the lens at the centre of the panel, so the
              // panel always shows precisely the region the cursor is over.
              backgroundPosition: `${PANEL / 2 - pointX * scale}px ${
                PANEL / 2 - pointY * scale
              }px`,
            }}
          />
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="rail gap-2">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => onSelect(index)}
              onMouseEnter={() => onSelect(index)}
              aria-label={`View image ${index + 1}`}
              aria-current={index === activeIndex}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-white transition-all ${
                index === activeIndex
                  ? "ring-2 ring-[color:var(--color-brand)]"
                  : "ring-1 ring-[color:var(--color-line)] hover:ring-[color:var(--color-line-strong)]"
              }`}
            >
              <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      ) : null}

      {viewerOpen ? (
        <TouchViewer
          images={images}
          name={name}
          index={activeIndex}
          onSelect={onSelect}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Fullscreen viewer for touch devices.
 *
 * Zooming is a scale on the image inside a scrollable box, so panning is the
 * browser's own scrolling — it stays smooth on a phone and keeps working with
 * the platform's pinch gesture, which a hand-rolled transform would fight.
 */
function TouchViewer({
  images,
  name,
  index,
  onSelect,
  onClose,
}: {
  images: string[];
  name: string;
  index: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // A new photo starts at fit-to-screen; carrying the previous zoom over would
  // drop the shopper into a random corner of a differently-shaped image.
  useEffect(() => setZoomed(false), [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Stop the page behind from scrolling while the viewer owns the screen.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${name} images`} className="fixed inset-0 z-[100] bg-black">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl text-white backdrop-blur"
      >
        ×
      </button>

      <div
        ref={scrollRef}
        className="h-full w-full overflow-auto overscroll-contain"
        style={{ touchAction: "pan-x pan-y pinch-zoom" }}
      >
        <div className={zoomed ? "min-h-full w-[250%]" : "flex h-full w-full items-center justify-center"}>
          <img
            src={images[index]}
            alt={`${name} — photo ${index + 1} of ${images.length}`}
            onClick={() => setZoomed((current) => !current)}
            className={zoomed ? "w-full" : "max-h-full max-w-full object-contain"}
          />
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-24 left-0 right-0 text-center text-[11px] text-white/70">
        {zoomed ? "Drag to pan · tap to fit" : "Tap the image to zoom · pinch to zoom further"}
      </p>

      {images.length > 1 ? (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 overflow-x-auto px-4">
          {images.map((image, position) => (
            <button
              key={image}
              type="button"
              onClick={() => onSelect(position)}
              aria-label={`View image ${position + 1}`}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded bg-white ${
                position === index ? "ring-2 ring-white" : "opacity-60"
              }`}
            >
              <img src={image} alt="" className="h-full w-full object-contain p-1" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
