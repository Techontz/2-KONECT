"use client";

import Link from "next/link";

import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import type { Category } from "@/lib/types";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";

/**
 * The footer.
 *
 * Two jobs: restate what 2KONECT actually does — because a first-time visitor
 * often reaches the bottom of a page still deciding — and carry the routes
 * that are too specific for the header. Deep purple so the page ends on the
 * brand rather than trailing off into grey.
 */
export function Footer({ categories = [] }: { categories?: Category[] }) {
  const t = useT();
  const year = new Date().getFullYear();

  const columns: { id: string; title: string; links: { href: string; label: string }[] }[] = [
    {
      id: "shop",
      title: t("footer.shop"),
      links: [
        { href: "/shop/local", label: t("footer.availableIn", { country: BRAND.country }) },
        { href: "/shop/abroad", label: t("footer.orderAbroad") },
        { href: "/deals", label: t("footer.deals") },
        { href: "/shop", label: t("footer.allProducts") },
        { href: "/vendors", label: t("footer.sellers") },
      ],
    },
    {
      id: "services",
      title: t("footer.services"),
      links: [
        { href: "/request", label: t("footer.requestProduct") },
        { href: "/track", label: t("footer.trackOrder") },
        { href: "/sell", label: t("footer.sellWith", { brand: BRAND.name }) },
        { href: "/account/deliveries", label: t("footer.rides", { brand: BRAND.name }) },
      ],
    },
    {
      id: "help",
      title: t("footer.help"),
      links: [
        { href: "/help", label: t("footer.helpCentre") },
        { href: "/help/delivery", label: t("footer.deliveryShipping") },
        { href: "/help/returns", label: t("footer.returnsLink") },
        { href: "/help/contact", label: t("footer.contactUs") },
      ],
    },
    {
      id: "company",
      title: t("footer.company"),
      links: [
        { href: "/about", label: t("footer.about", { brand: BRAND.name }) },
        { href: "/legal/terms", label: t("footer.terms") },
        { href: "/legal/privacy", label: t("footer.privacyLink") },
        { href: "/legal/cookies", label: t("footer.cookiesLink") },
      ],
    },
  ];

  return (
    <footer className="brand-ground mt-10">
      <div className="shell py-10 lg:py-14">
        <div className="grid gap-9 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2.6fr)]">
          {/* ---- who we are ---- */}
          <div>
            <Logo tone="dark" size="lg" />
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/75">
              {t("footer.promise")}
            </p>

            <dl className="mt-5 space-y-1.5 text-[13px] text-white/75">
              <div className="flex gap-2">
                <dt className="sr-only">{t("footer.email")}</dt>
                <dd>
                  <a className="hover:text-white" href={`mailto:${BRAND.supportEmail}`}>
                    {BRAND.supportEmail}
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">{t("footer.phone")}</dt>
                <dd>
                  <a className="hover:text-white" href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`}>
                    {BRAND.supportPhone}
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">{t("footer.address")}</dt>
                <dd>{BRAND.city}, {BRAND.country}</dd>
              </div>
            </dl>

            <div className="mt-5">
              <LanguageSwitcher tone="dark" />
            </div>
          </div>

          {/* ---- links ---- */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {columns.map((column) => (
              <nav key={column.id} aria-label={column.title}>
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-white/55">
                  {column.title}
                </h2>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        prefetch={false}
                        className="inline-flex min-h-[28px] items-center text-[13px] text-white/80 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* ---- categories, for crawlers as much as for shoppers ---- */}
        {categories.length > 0 ? (
          <nav aria-label={t("footer.popularCategories")} className="mt-10 border-t border-white/12 pt-6">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-white/55">
              {t("footer.popularCategories")}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {categories.slice(0, 14).map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/category?id=${category.id}`}
                    prefetch={false}
                    className="text-[12px] text-white/65 hover:text-white"
                  >
                    {category.name.trim()}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      <div className="border-t border-white/12">
        <div className="shell flex flex-col gap-2 py-5 text-[12px] text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.rights", { year, brand: BRAND.name })}</p>
          <p>
            {t("footer.builtBy")}{" "}
            <a
              href="https://techon.co.tz"
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-white/80 hover:text-white"
            >
              TechOn
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
