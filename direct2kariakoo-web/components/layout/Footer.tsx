"use client";

import Link from "next/link";

import { BRAND } from "@/lib/brand";
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
  const year = new Date().getFullYear();

  const columns: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: "Shop",
      links: [
        { href: "/shop/local", label: "Available in Tanzania" },
        { href: "/shop/abroad", label: "Order from abroad" },
        { href: "/deals", label: "Deals" },
        { href: "/shop", label: "All products" },
        { href: "/vendors", label: "Sellers" },
      ],
    },
    {
      title: "Services",
      links: [
        { href: "/request", label: "Request a product" },
        { href: "/track", label: "Track your order" },
        { href: "/sell", label: `Sell with ${BRAND.name}` },
        { href: "/account/deliveries", label: "2KONECT Rides" },
      ],
    },
    {
      title: "Help",
      links: [
        { href: "/help", label: "Help centre" },
        { href: "/help/delivery", label: "Delivery & shipping" },
        { href: "/help/returns", label: "Returns" },
        { href: "/help/contact", label: "Contact us" },
      ],
    },
    {
      title: "Company",
      links: [
        { href: "/about", label: `About ${BRAND.name}` },
        { href: "/legal/terms", label: "Terms" },
        { href: "/legal/privacy", label: "Privacy" },
        { href: "/legal/cookies", label: "Cookies" },
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
              {BRAND.promise}
            </p>

            <dl className="mt-5 space-y-1.5 text-[13px] text-white/75">
              <div className="flex gap-2">
                <dt className="sr-only">Email</dt>
                <dd>
                  <a className="hover:text-white" href={`mailto:${BRAND.supportEmail}`}>
                    {BRAND.supportEmail}
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Phone</dt>
                <dd>
                  <a className="hover:text-white" href={`tel:${BRAND.supportPhone.replace(/\s/g, "")}`}>
                    {BRAND.supportPhone}
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Address</dt>
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
              <nav key={column.title} aria-label={column.title}>
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
          <nav aria-label="Popular categories" className="mt-10 border-t border-white/12 pt-6">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-white/55">
              Popular categories
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
          <p>© {year} {BRAND.name}. All rights reserved.</p>
          <p>
            Built by{" "}
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
