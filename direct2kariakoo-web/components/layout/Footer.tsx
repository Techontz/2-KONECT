"use client";

import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import type { Category } from "@/lib/types";

/**
 * Information-dense footer, matching the reference storefront's structure but
 * written for {BRAND.name} and Tanzania — no imported copy, no foreign
 * markets, no payment brands we do not actually take.
 */
export function Footer({ categories = [] }: { categories?: Category[] }) {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-[color:var(--color-line)] bg-[color:var(--color-surface)]">
      {/* Shop by category — driven by the real catalogue. */}
      {categories.length > 0 ? (
        <div className="border-b border-[color:var(--color-line)]">
          <div className="shell py-6">
            <h2 className="mb-3 text-sm font-extrabold">{t("footer.shopByCategory")}</h2>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category?id=${category.id}`}
                  prefetch={false}
                  className="text-[13px] text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:underline"
                >
                  {category.name.trim()}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="shell grid grid-cols-2 gap-8 py-10 md:grid-cols-4">
        <FooterColumn
          title={t("footer.customerService")}
          links={[
            { label: t("footer.help"), href: "/help" },
            { label: t("footer.trackOrder"), href: "/account/orders" },
            { label: t("footer.returns"), href: "/help/returns" },
            { label: t("footer.deliveryInfo"), href: "/help/delivery" },
            { label: t("footer.contact"), href: "/help/contact" },
          ]}
        />
        <FooterColumn
          title={t("footer.about", { brand: BRAND.short })}
          links={[
            { label: t("footer.whoWeAre"), href: "/about" },
            { label: t("footer.ourVendors"), href: "/vendors" },
            { label: t("footer.help"), href: "/help" },
            { label: t("footer.contact"), href: "/help/contact" },
          ]}
        />
        <FooterColumn
          title={t("footer.sellWithUs")}
          links={[
            { label: t("footer.sellOn", { brand: BRAND.short }), href: "/sell" },
            { label: t("footer.sellerDashboard"), href: "/vendor/dashboard" },
            { label: t("footer.sellerGuidelines"), href: "/sell/guidelines" },
            { label: t("footer.sellerSupport"), href: "/sell/support" },
          ]}
        />

        <div>
          <h3 className="mb-3 text-sm font-extrabold">{t("footer.getInTouch")}</h3>
          <ul className="space-y-2 text-[13px] text-[color:var(--color-ink-muted)]">
            <li>
              {/* A long address is one unbroken token — without break-words it
                  is the only thing on the page that overflows a 390px phone. */}
              <a
                href={`mailto:${BRAND.supportEmail}`}
                className="break-words hover:text-[color:var(--color-ink)] hover:underline"
              >
                {BRAND.supportEmail}
              </a>
            </li>
            <li>
              <a href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`} className="hover:text-[color:var(--color-ink)] hover:underline">
                {BRAND.supportPhone}
              </a>
            </li>
            <li>{BRAND.city}, {BRAND.country}</li>
          </ul>

          <h3 className="mb-2 mt-6 text-sm font-extrabold">{t("footer.weAccept")}</h3>
          <div className="flex flex-wrap gap-2">
            {[t("payment.mpesa"), t("payment.tigo"), t("payment.airtel"), t("payment.cashOnDelivery")].map((method) => (
              <span
                key={method}
                className="rounded-[var(--radius-xs)] border border-[color:var(--color-line)] px-2 py-1 text-[11px] font-semibold text-[color:var(--color-ink-muted)]"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--color-line)]">
        <div className="shell flex flex-col gap-2 py-5 text-[12px] text-[color:var(--color-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.rights", { year, brand: BRAND.name })}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/legal/terms" className="hover:underline">{t("footer.termsOfUse")}</Link>
            <Link href="/legal/privacy" className="hover:underline">{t("footer.privacy")}</Link>
            <Link href="/legal/cookies" className="hover:underline">{t("footer.cookies")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-extrabold">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              prefetch={false}
              className="text-[13px] text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Footer;
