"use client";

/**
 * Compact store header used by the legacy vendor sub-pages (messages,
 * settings, wallet). The dashboard, products and orders screens carry their
 * own headings; this keeps the remaining pages consistent with the console
 * shell without reintroducing the old mobile-first chrome.
 */
export default function VendorHeader({
  vendor,
}: {
  vendor?: {
    business_name?: string | null;
    logo?: string | null;
    is_approved?: boolean | number | null;
  } | null;
}) {
  const name = vendor?.business_name ?? "Your store";

  return (
    <header className="mb-4 flex items-center gap-3 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
      {vendor?.logo ? (
        <img
          src={vendor.logo}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-[color:var(--color-line)]"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-alt)] text-base font-black">
          {name.charAt(0).toUpperCase()}
        </span>
      )}

      <div className="min-w-0">
        <p className="clamp-1 text-[16px] font-black leading-tight">{name}</p>
        {vendor?.is_approved !== undefined && vendor?.is_approved !== null ? (
          <p
            className={`text-[11px] font-semibold ${
              vendor.is_approved
                ? "text-[color:var(--color-success)]"
                : "text-[color:var(--color-warn)]"
            }`}
          >
            {vendor.is_approved ? "✓ Approved seller" : "⏳ Awaiting approval"}
          </p>
        ) : null}
      </div>
    </header>
  );
}
