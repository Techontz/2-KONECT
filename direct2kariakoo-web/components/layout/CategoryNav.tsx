"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Category } from "@/lib/types";

/**
 * The category bar, directly beneath the header on a desktop.
 *
 * "All categories" opens the full tree; beside it sit the routes that define
 * 2KONECT rather than the catalogue — the two ways to buy, and the sourcing
 * desk. Those are first-class navigation, not links buried in a footer.
 */
export function CategoryNav({ categories }: { categories: Category[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // A menu that stays open after the pointer has left the bar is a trap.
  useEffect(() => {
    function close(event: MouseEvent) {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpenId(null);
        setAllOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenId(null);
        setAllOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Only the busiest categories earn a slot; the rest live behind "All".
  const featured = [...categories]
    .sort((a, b) => b.product_count - a.product_count)
    .slice(0, 6);

  const open = categories.find((category) => category.id === openId) ?? null;

  return (
    <div
      ref={barRef}
      className="relative border-b border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
      onMouseLeave={() => { setOpenId(null); setAllOpen(false); }}
    >
      <nav aria-label="Categories" className="shell flex h-11 items-center gap-1 text-[13px] font-semibold">
        <button
          type="button"
          onMouseEnter={() => { setAllOpen(true); setOpenId(null); }}
          onClick={() => setAllOpen((value) => !value)}
          aria-expanded={allOpen}
          className="flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] px-3 text-white"
        >
          <GridIcon className="h-4 w-4" />
          All categories
        </button>

        <NavPill href="/shop/local" accent="local">
          <span aria-hidden="true">🇹🇿</span> In Tanzania
        </NavPill>
        <NavPill href="/shop/abroad" accent="import">
          <span aria-hidden="true">🌍</span> From abroad
        </NavPill>

        <span aria-hidden="true" className="mx-1 h-5 w-px bg-[color:var(--color-line)]" />

        {featured.map((category) => (
          <button
            key={category.id}
            type="button"
            onMouseEnter={() => { setOpenId(category.id); setAllOpen(false); }}
            onClick={() => (window.location.href = `/category?id=${category.id}`)}
            className={`hidden h-8 shrink-0 items-center rounded-[var(--radius-sm)] px-2.5 transition-colors xl:flex ${
              openId === category.id
                ? "bg-[color:var(--color-brand-50)] text-[color:var(--color-brand)]"
                : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface-alt)]"
            }`}
          >
            {category.name.trim()}
          </button>
        ))}

        <span className="ml-auto flex items-center gap-1">
          <NavPill href="/deals">Deals</NavPill>
          <NavPill href="/request" accent="brand">Request a product</NavPill>
        </span>
      </nav>

      {/* ---- the full tree ---- */}
      {allOpen ? (
        <div className="fade-in absolute inset-x-0 top-full z-40 border-b border-[color:var(--color-line)] bg-white shadow-[var(--shadow-pop)]">
          <div className="shell grid max-h-[70vh] grid-cols-2 gap-x-6 gap-y-4 overflow-y-auto py-5 md:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <div key={category.id}>
                <Link
                  href={`/category?id=${category.id}`}
                  prefetch={false}
                  onClick={() => setAllOpen(false)}
                  className="block text-[13px] font-extrabold hover:text-[color:var(--color-brand)]"
                >
                  {category.name.trim()}
                  <span className="ml-1.5 font-normal text-[color:var(--color-ink-faint)]">
                    {category.product_count}
                  </span>
                </Link>
                <ul className="mt-1.5 space-y-1">
                  {category.subcategories.slice(0, 5).map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/search?subcategory_id=${sub.id}`}
                        prefetch={false}
                        onClick={() => setAllOpen(false)}
                        className="block truncate text-[12px] text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-brand)]"
                      >
                        {sub.name.trim()}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- one category's subcategories ---- */}
      {open && open.subcategories.length > 0 ? (
        <div className="fade-in absolute inset-x-0 top-full z-40 border-b border-[color:var(--color-line)] bg-white shadow-[var(--shadow-pop)]">
          <div className="shell grid grid-cols-2 gap-x-6 gap-y-2 py-5 md:grid-cols-4 lg:grid-cols-5">
            {open.subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={`/search?subcategory_id=${sub.id}`}
                prefetch={false}
                onClick={() => setOpenId(null)}
                className="truncate rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-brand-50)] hover:text-[color:var(--color-brand)]"
              >
                {sub.name.trim()}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NavPill({
  href,
  accent,
  children,
}: {
  href: string;
  accent?: "local" | "import" | "brand";
  children: React.ReactNode;
}) {
  const tones = {
    local: "text-[color:var(--color-local)] hover:bg-[color:var(--color-local-soft)]",
    import: "text-[color:var(--color-import)] hover:bg-[color:var(--color-import-soft)]",
    brand: "text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-50)]",
  };

  return (
    <Link
      href={href}
      prefetch={false}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 transition-colors ${
        accent ? tones[accent] : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface-alt)]"
      }`}
    >
      {children}
    </Link>
  );
}

function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
