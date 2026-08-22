"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import type { ProductDetail, ProductVendor } from "@/lib/types";
import { isOfficialSeller, OfficialBadge, VerifiedBadge } from "@/components/sourcing/Trust";

/**
 * Seller block on the product page: who is selling, and how to reach them.
 *
 * Every contact action is driven by data the backend has already validated —
 * `phone`, `whatsapp` and `location` arrive normalised, and are null when the
 * stored value is not usable. An action whose data is null is simply not
 * rendered, so the page never offers a dead link or an invented number.
 */
export function SellerPanel({
  vendor,
  product,
  onChat,
}: {
  vendor: ProductVendor;
  product: ProductDetail;
  onChat(): void;
}) {
  const t = useT();
  return (
    <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
        Sold by
      </p>

      <Link
        href={`/vendors?id=${vendor.id}`}
        prefetch={false}
        className="group flex items-center gap-3 rounded-[var(--radius-sm)] p-1 -m-1 transition-colors hover:bg-[color:var(--color-surface-alt)]"
      >
        {vendor.logo ? (
          <img
            src={vendor.logo}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--color-line)]"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-alt)] text-sm font-bold">
            {vendor.name.charAt(0)}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="clamp-1 block text-sm font-bold group-hover:underline">{vendor.name}</span>
          {/* Approval only lets a shop trade; the badge means an
              administrator checked the business behind it. */}
          <span className="mt-0.5 flex flex-wrap items-center gap-1">
            {isOfficialSeller(vendor.name) ? <OfficialBadge /> : null}
            {vendor.is_verified ? (
              <VerifiedBadge size="sm" />
            ) : (
              <span className="text-[11px] text-[color:var(--color-ink-faint)]">{t("seller.approvedSeller")}</span>
            )}
          </span>
        </span>

        <span aria-hidden="true" className="shrink-0 text-[color:var(--color-ink-faint)]">›</span>
      </Link>

      {vendor.member_since || vendor.location ? (
        <div className="mt-3 space-y-1 border-t border-[color:var(--color-line)] pt-3 text-[12px] text-[color:var(--color-ink-muted)]">
          {vendor.member_since ? (
            <p>Selling on {BRAND.name} since {vendor.member_since}</p>
          ) : null}
          {vendor.location ? (
            <p className="flex gap-1.5">
              <PinIcon className="mt-[2px] h-3.5 w-3.5 shrink-0" />
              <span className="clamp-2">{vendor.location}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Hidden below lg: the phone layout renders these higher up, directly
          under the buy buttons, so showing them again here would duplicate. */}
      <div className="mt-3 hidden border-t border-[color:var(--color-line)] pt-3 lg:block">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
          Contact this seller
        </p>
        <SellerActions vendor={vendor} product={product} onChat={onChat} />

        {vendor.phone_display ? (
          <p className="mt-2 text-center text-[11px] text-[color:var(--color-ink-muted)]">
            {vendor.phone_display}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Chat / WhatsApp / Call.
 *
 * Exported separately because the phone layout needs these directly beneath
 * the buy buttons — a shopper should not have to scroll past a long
 * description to find out how to reach the seller.
 */
export function SellerActions({
  vendor,
  product,
  onChat,
}: {
  vendor: ProductVendor;
  product: ProductDetail;
  onChat(): void;
}) {
  const t = useT();
  const waLink = vendor.whatsapp
    ? `${vendor.whatsapp}${vendor.whatsapp.includes("?") ? "&" : "?"}text=${encodeURIComponent(
        t("product.sellerGreeting", { name: product.name, brand: BRAND.name }),
      )}`
    : null;

  const hasContact = Boolean(waLink || vendor.phone);

  return (
    <>
      <button
        type="button"
        onClick={onChat}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[color:var(--color-brand)] text-[13px] font-bold text-white transition-colors hover:bg-[color:var(--color-brand-strong)]"
      >
        <ChatIcon className="h-4 w-4 shrink-0" />
        Message seller
      </button>

      {hasContact ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] text-[13px] font-bold transition-colors hover:border-[color:var(--color-success)] hover:text-[color:var(--color-success)]"
            >
              <WhatsAppIcon className="h-4 w-4 shrink-0" />
              WhatsApp
            </a>
          ) : null}

          {vendor.phone ? (
            <a
              href={`tel:${vendor.phone}`}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] text-[13px] font-bold transition-colors hover:border-[color:var(--color-ink)] ${
                waLink ? "" : "col-span-2"
              }`}
            >
              <PhoneIcon className="h-4 w-4 shrink-0" />
              Call
            </a>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[color:var(--color-ink-faint)]">
          This seller has not published a phone number — send a message instead.
        </p>
      )}
    </>
  );
}

/* ---------------- icons ---------------- */

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

function PhoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 1.9.6 2.8a2 2 0 01-.5 2.1L8.1 9.8a16 16 0 006 6l1.2-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.8.6a2 2 0 011.8 2.1z" />
    </svg>
  );
}

function ChatIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-3.8-.8L3 21l1.9-5a8.3 8.3 0 01-.9-3.8 8.4 8.4 0 018.5-8.2h.5a8.4 8.4 0 018 8v.5z" />
    </svg>
  );
}

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1a8.2 8.2 0 01-2.4-1.5 9 9 0 01-1.7-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5v-.5l-1-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.3 5.3 4.6.7.3 1.3.5 1.8.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3z" />
      <path d="M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1112 20.2z" />
    </svg>
  );
}
