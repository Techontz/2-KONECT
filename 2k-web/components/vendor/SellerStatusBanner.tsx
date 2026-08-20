"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * Where the seller's application stands, at the top of their dashboard.
 *
 * Two states are shown because they mean different things: whether the store
 * may sell at all, and whether it carries the verified checkmark. Both come
 * from the backend — nothing here infers status from uploaded files.
 */
interface SellerStatus {
  store: { name: string; logo: string | null };
  seller: { status: string; can_publish: boolean; note: string | null };
  verification: {
    status: string;
    is_verified: boolean;
    can_apply: boolean;
    note: string | null;
  };
}

export function SellerStatusBanner() {
  const t = useT();
  const [status, setStatus] = useState<SellerStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<SellerStatus>("/shop/seller/status")
      .then(({ data }) => { if (!cancelled) setStatus(data); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, []);

  if (!status) return null;

  const { seller, verification, store } = status;

  const tone =
    seller.status === "approved"
      ? { bg: "var(--color-success-soft)", fg: "var(--color-success)" }
      : seller.status === "pending"
        ? { bg: "var(--color-warn-soft)", fg: "var(--color-warn)" }
        : { bg: "#fdecec", fg: "var(--color-sale)" };

  const headline =
    seller.status === "approved" ? t("seller.statusApproved")
      : seller.status === "pending" ? t("seller.statusPending")
      : seller.status === "suspended" ? t("seller.statusSuspended")
      : t("seller.statusRejected");

  return (
    <section className="mb-4 overflow-hidden rounded-[var(--radius-md)] bg-[color:var(--color-brand)] text-white">
      <div className="flex flex-wrap items-center gap-4 p-5">
        {store.logo ? (
          <img src={store.logo} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/60" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-xl font-black text-[color:var(--color-brand)]">
            {store.name.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="clamp-1 text-[20px] font-black leading-tight">
            {t("seller.welcome", { store: store.name })}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-[3px] text-[11px] font-black uppercase tracking-wide"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {headline}
            </span>

            {verification.is_verified ? (
              <span className="rounded-full bg-[color:var(--color-success-soft)] px-2.5 py-[3px] text-[11px] font-black uppercase tracking-wide text-[color:var(--color-success)]">
                ✓ {t("seller.verified")}
              </span>
            ) : verification.status === "pending" ? (
              <span className="rounded-full bg-[color:var(--color-warn-soft)] px-2.5 py-[3px] text-[11px] font-black uppercase tracking-wide text-[color:var(--color-warn)]">
                {t("seller.verifyPending")}
              </span>
            ) : null}
          </div>
        </div>

        {verification.can_apply ? (
          <Link
            href="/vendor/settings/profile"
            className="shrink-0 rounded-[var(--radius-sm)] bg-[color:var(--color-brand-ink)] px-4 py-2.5 text-[13px] font-bold text-[color:var(--color-brand)]"
          >
            {t("seller.getVerified")}
          </Link>
        ) : null}
      </div>

      {/* Whatever the reviewer wrote, shown verbatim so the seller knows what
          to fix rather than guessing. */}
      {seller.note || verification.note ? (
        <p className="border-t border-white/15 bg-[color:var(--color-brand-deep)] px-5 py-2.5 text-[12px] font-semibold text-white">
          {seller.note ?? verification.note}
        </p>
      ) : !seller.can_publish ? (
        <p className="border-t border-white/15 bg-[color:var(--color-brand-deep)] px-5 py-2.5 text-[12px] text-white/85">
          {t("seller.statusPendingHint")}
        </p>
      ) : null}
    </section>
  );
}
