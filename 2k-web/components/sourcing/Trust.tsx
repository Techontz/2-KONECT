"use client";

import { BRAND } from "@/lib/brand";
import { CheckIcon, LockIcon, ShieldIcon, TruckIcon } from "./icons";

/* ==========================================================================
   The trust layer.

   A marketplace asks people to pay strangers for things they cannot touch,
   and an imported order asks them to wait weeks for it. These are the small
   assurances that carry that — each one tied to something the backend
   actually knows, never decoration.
   ========================================================================== */

/**
 * The verified-seller checkmark.
 *
 * Granted only by an administrator, so it means something. Deliberately not a
 * claim about the goods — see the wording: it says the seller was checked, not
 * that the product is guaranteed.
 */
export function VerifiedBadge({
  size = "md",
  label = "Verified seller",
  className = "",
}: {
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const compact = size === "sm";

  return (
    <span
      title="This seller has been checked by 2KONECT."
      className={`inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[color:var(--color-brand-100)] px-1.5 py-[3px] font-bold text-[color:var(--color-brand)] ${
        compact ? "text-[10px]" : "text-[11px]"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center rounded-full bg-[color:var(--color-brand)] text-white ${
          compact ? "h-3 w-3" : "h-3.5 w-3.5"
        }`}
      >
        <CheckIcon className={compact ? "h-2 w-2" : "h-2.5 w-2.5"} />
      </span>
      {label}
    </span>
  );
}

/**
 * The platform's own storefront, marked as such.
 *
 * 2KONECT sells alongside the sellers it hosts, and a shopper is entitled to
 * know which they are buying from. Recognised by name rather than by a column,
 * because "is this us?" is a fact about the brand, not about the vendor table.
 */
export function isOfficialSeller(name: string | null | undefined): boolean {
  return typeof name === "string" && name.trim().toLowerCase() === BRAND.officialSeller.toLowerCase();
}

export function OfficialBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title={`Sold and fulfilled by ${BRAND.name}.`}
      className={`inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[color:var(--color-brand)] px-1.5 py-[3px] text-[10px] font-bold uppercase tracking-wide text-white ${className}`}
    >
      {/* Just "Official": the seller's name is already beside it, and
          repeating the brand twice in two centimetres reads as a stutter. */}
      Official
    </span>
  );
}

/**
 * The reassurance strip under a buy box.
 *
 * Three short facts, no adjectives. Nothing here claims more than the
 * platform actually does — no "100% genuine", no guarantee it cannot honour.
 */
export function TrustRow({ isLocal, className = "" }: { isLocal: boolean; className?: string }) {
  const items = [
    { icon: <LockIcon className="h-4 w-4" />, label: "Secure checkout" },
    {
      icon: <TruckIcon className="h-4 w-4" />,
      label: isLocal ? "Delivered across Tanzania" : "Import handled by 2KONECT",
    },
    { icon: <ShieldIcon className="h-4 w-4" />, label: "Tracked at every step" },
  ];

  return (
    <ul className={`grid gap-1.5 sm:grid-cols-3 ${className}`}>
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-alt)] px-2.5 py-2 text-[11px] font-semibold text-[color:var(--color-ink-soft)]"
        >
          <span className="text-[color:var(--color-brand)]">{item.icon}</span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
