"use client";

import Link from "next/link";
import { useState } from "react";

import { BRAND } from "@/lib/brand";
import { useAuth } from "@/lib/store/auth";
import { Button } from "@/components/ui/Primitives";
import { VerifiedBadge } from "@/components/sourcing/Trust";

/**
 * Store settings.
 *
 * A hub, not a screen full of controls: everything a seller can actually
 * change lives on its own page, and this lists them.
 *
 * The previous version read a `token` key nothing writes any more and pushed
 * the seller back to the shop when it was missing, cached the vendor in three
 * places, and offered a "Push notifications" screen whose switches saved
 * nothing and an "App preferences" tile that opened an alert. Those are gone —
 * a control that does nothing is worse than no control.
 */
export default function VendorSettingsPage() {
  const { user, logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const vendor = user?.vendor;

  const groups: { title: string; items: { href: string; label: string; note: string }[] }[] = [
    {
      title: "Your store",
      items: [
        { href: "/vendor/settings/profile", label: "Store profile", note: "Name, logo, contact details and payout methods" },
        { href: "/vendor/products", label: "Products", note: "Everything you have listed" },
        { href: "/vendor/settings/wallet", label: "Wallet", note: "Earnings and payout requests" },
      ],
    },
    {
      title: "Selling on 2KONECT",
      items: [
        { href: "/sell/guidelines", label: "Seller guidelines", note: "What we expect from a listing" },
        { href: "/sell/support", label: "Seller support", note: "Approval, listings, orders and payouts" },
        { href: "/help/contact", label: "Contact us", note: "Talk to a person about your store" },
      ],
    },
  ];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <header>
        <h1 className="text-[24px] font-black tracking-[-0.025em]">Store settings</h1>
        <p className="text-[13px] text-[color:var(--color-ink-muted)]">
          Everything about how your store appears and gets paid.
        </p>
      </header>

      {/* ---- who this store is ---- */}
      <section className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
        {vendor?.logo ? (
          <img
            src={vendor.logo}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--color-line)]"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-100)] text-[17px] font-black text-[color:var(--color-brand)]">
            {(vendor?.business_name ?? user?.name ?? "?").charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="clamp-1 text-[17px] font-black">{vendor?.business_name ?? user?.name}</p>
          <p className="clamp-1 text-[12px] text-[color:var(--color-ink-muted)]">{user?.email}</p>
        </div>

        <span className="flex flex-wrap items-center gap-1.5">
          {vendor?.is_approved ? (
            <VerifiedBadge label="Approved to sell" />
          ) : (
            <span className="rounded-[var(--radius-xs)] bg-[color:var(--color-warn-soft)] px-2 py-1 text-[11px] font-bold text-[color:var(--color-warn)]">
              Awaiting approval
            </span>
          )}
        </span>
      </section>

      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-ink-faint)]">
            {group.title}
          </h2>
          <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
            {group.items.map((item) => (
              <li key={item.href} className="border-b border-[color:var(--color-line)] last:border-0">
                <Link
                  href={item.href}
                  prefetch={false}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[color:var(--color-surface-alt)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold">{item.label}</span>
                    <span className="block truncate text-[12px] text-[color:var(--color-ink-muted)]">
                      {item.note}
                    </span>
                  </span>
                  <ChevronIcon className="h-4 w-4 shrink-0 text-[color:var(--color-ink-faint)]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
        <p className="text-[13px] text-[color:var(--color-ink-muted)]">
          Signed in to the {BRAND.name} seller console.
        </p>

        {confirming ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="dark" onClick={logout}>Yes, sign out</Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Stay signed in</Button>
          </div>
        ) : (
          <Button variant="secondary" className="mt-3" onClick={() => setConfirming(true)}>
            Sign out
          </Button>
        )}
      </section>
    </div>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
