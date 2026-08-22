"use client";

import { BRAND } from "@/lib/brand";
import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { formatMoney } from "@/lib/format";
import { keyOf, lineSourcing, unitPrice, useCart } from "@/lib/store/cart";
import { useCartQuote } from "@/lib/useCartQuote";
import { useWishlist } from "@/lib/store/wishlist";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { AvailabilityBadge, DeliveryEstimate } from "@/components/sourcing/Availability";
import { Button, ButtonLink, EmptyState } from "@/components/ui/Primitives";

/** Matches OrderController::DELIVERY_FEE. */
const DELIVERY_FEE = 3000;

/**
 * Cart.
 *
 * Fully usable signed-out — a visitor can review and adjust their basket
 * before ever being asked who they are. Authentication happens one step later,
 * at checkout.
 *
 * A basket can mix local stock with imported lines, and those arrive weeks
 * apart. Rather than average that into one misleading date, each line states
 * its own, and the summary says plainly that the order will arrive in more
 * than one delivery.
 */
export default function CartPage() {
  const t = useT();
  const cart = useCart();

  // What the server would actually charge. Quantity tiers live there, so the
  // cart asks rather than guessing; if the call fails the per-line prices
  // below still render, and they are correct for any product without tiers.
  const { lineFor, quote } = useCartQuote(cart.lines, cart.ready);
  const wishlist = useWishlist();
  const router = useRouter();

  if (cart.ready && cart.lines.length === 0) {
    return (
      <SiteChrome>
        <div className="pb-tabbar">
          <EmptyState
            icon={<CartIcon className="h-9 w-9" />}
            title={t("cart.empty")}
            message={t("cart.emptyHint")}
            action={
              <>
                <ButtonLink href="/shop/local" size="lg">{t("cart.shopInCountry", { country: BRAND.country })}</ButtonLink>
                <ButtonLink href="/shop/abroad" size="lg" variant="secondary">{t("cart.orderAbroad")}</ButtonLink>
              </>
            }
          />
        </div>
      </SiteChrome>
    );
  }

  const subtotal = quote?.subtotal.current ?? cart.subtotal;
  const total = subtotal + (cart.lines.length ? DELIVERY_FEE : 0);

  // The two halves of a mixed basket, so the summary can be honest about the
  // fact that they will not turn up together.
  const importLines = cart.lines.filter((line) => lineSourcing(line)?.is_local === false);
  const localLines = cart.lines.filter((line) => lineSourcing(line)?.is_local === true);

  /** True when the basket genuinely splits — both halves present. */
  const mixed = importLines.length > 0 && localLines.length > 0;

  /** The slowest promise within one half, which is when that half completes. */
  function windowFor(lines: typeof cart.lines): string | null {
    const slowestLine = lines
      .map((line) => lineSourcing(line))
      .filter((sourcing): sourcing is NonNullable<typeof sourcing> => Boolean(sourcing))
      .sort((a, b) => (b.lead_time.max ?? 0) - (a.lead_time.max ?? 0))[0];

    return slowestLine?.lead_time.label ?? null;
  }

  const localWindow = windowFor(localLines);
  const importWindow = windowFor(importLines);
  const slowest = cart.lines.reduce(
    (max, line) => Math.max(max, lineSourcing(line)?.lead_time.max ?? 0),
    0,
  );

  return (
    <SiteChrome>
      <div className="shell py-4 pb-tabbar">
        <h1 className="mb-4 text-[22px] font-black tracking-[-0.02em] md:text-[28px]">
          Your cart <span className="text-[color:var(--color-ink-muted)]">({cart.count})</span>
        </h1>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-3">
            {cart.lines.map((line) => {
              const { product, quantity, option } = line;
              const key = keyOf(line);
              const sourcing = lineSourcing(line);
              // The server's price when it has answered, the local one until
              // then — they differ only where a quantity tier applies.
              const quoted = lineFor(line);
              const price = quoted?.unit_price.current ?? unitPrice(line);
              const ceiling = sourcing && !sourcing.is_local ? 99 : Math.max(option?.stock ?? product.stock, 1);

              return (
                <article
                  key={key}
                  className="flex gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3"
                >
                  <Link
                    href={`/product?id=${product.id}`}
                    prefetch={false}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-white ring-1 ring-[color:var(--color-line)]"
                  >
                    {product.image ? (
                      <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-contain p-1" />
                    ) : null}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/product?id=${product.id}`} prefetch={false} className="clamp-2 text-[14px] font-semibold hover:underline">
                      {product.name}
                    </Link>

                    {/* Which combination, when the product sells by option.
                        Two variants of one product are two lines here, and
                        without this they would read as a duplicate. */}
                    {line.variantLabel ? (
                      <p className="mt-0.5 text-[12px] font-semibold text-[color:var(--color-ink-soft)]">
                        {line.variantLabel}
                      </p>
                    ) : null}

                    {/* How this line is being bought, right under its name —
                        two lines of the same product can sit in one cart at
                        two prices, and this is what tells them apart. */}
                    {sourcing ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <AvailabilityBadge sourcing={sourcing} size="sm" />
                        <DeliveryEstimate sourcing={sourcing} size="sm" />
                      </div>
                    ) : null}

                    <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-faint)]">
                      {t("cart.soldByName", { name: option?.seller ?? product.vendor?.name ?? BRAND.name })}
                    </p>

                    {sourcing?.is_local && product.stock > 0 && product.stock <= 5 ? (
                      <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--color-warn)]">
                        {t("cart.onlyLeft", { count: product.stock })}
                      </p>
                    ) : null}

                    <p className="mt-1 text-[16px] font-black">{formatMoney(price)}</p>

                    {/* The stepper has a fixed width and the actions have long
                        labels, so they wrap to their own run on a narrow card
                        rather than being squeezed off the row. */}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex h-10 items-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)]">
                        <StepButton label={t("common.decreaseQuantity")} onClick={() => cart.setQuantity(key, quantity - 1)}>
                          −
                        </StepButton>
                        <span className="w-9 text-center text-[13px] font-bold tabular-nums">{quantity}</span>
                        <StepButton
                          label={t("common.increaseQuantity")}
                          disabled={quantity >= ceiling}
                          onClick={() => cart.setQuantity(key, quantity + 1)}
                        >
                          +
                        </StepButton>
                      </div>

                      <div className="flex items-center gap-3 text-[12px] font-semibold">
                        <button
                          type="button"
                          onClick={() => { void wishlist.toggle(product.id); cart.remove(key); }}
                          className="text-[color:var(--color-brand)] hover:underline"
                        >
                          {t("cart.saveForLater")}
                        </button>
                        <button
                          type="button"
                          onClick={() => cart.remove(key)}
                          className="text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-sale)] hover:underline"
                        >
                          {t("common.remove")}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          {/* ---- summary ---- */}
          <aside className="lg:sticky lg:top-[calc(var(--header-height)+16px)] lg:self-start">
            <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
              <h2 className="mb-3 text-[15px] font-black">{t("cart.orderSummary")}</h2>

              <dl className="space-y-2 text-[13px]">
                <SummaryRow
                  label={cart.count === 1 ? t("cart.subtotalItemOne") : t("cart.subtotalItems", { count: cart.count })}
                  value={formatMoney(subtotal)}
                />
                <SummaryRow label={t("cart.delivery")} value={formatMoney(DELIVERY_FEE)} />
              </dl>

              <div className="mt-3 flex items-baseline justify-between border-t border-[color:var(--color-line)] pt-3">
                <span className="text-[14px] font-black">{t("cart.total")}</span>
                <span className="text-[22px] font-black tracking-[-0.02em]">{formatMoney(total)}</span>
              </div>

              {/* ---- how this basket actually arrives ----
                  A mixed basket does not arrive together, and a single "within
                  N days" line quietly implies that it does. Each half is
                  stated separately, with its own count and its own window, so
                  nobody discovers the difference after paying. */}
              {mixed ? (
                <div className="mt-3 space-y-px overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--color-line)]">
                  <p className="bg-[color:var(--color-surface-alt)] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
                    {t("cart.twoDeliveries")}
                  </p>

                  <div className="flex items-center justify-between gap-3 bg-[color:var(--color-local-soft)] px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[color:var(--color-local)]">
                      <span aria-hidden="true">🇹🇿</span>
                      {localLines.length === 1
                        ? t("cart.itemInCountry", { country: BRAND.country })
                        : t("cart.itemsInCountry", { count: localLines.length, country: BRAND.country })}
                    </span>
                    <span className="shrink-0 text-[12.5px] font-bold text-[color:var(--color-local)]">
                      {localWindow ?? "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-[color:var(--color-import-soft)] px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[color:var(--color-import)]">
                      <span aria-hidden="true">🌍</span>
                      {importLines.length === 1
                        ? t("cart.itemFromAbroad")
                        : t("cart.itemsFromAbroad", { count: importLines.length })}
                    </span>
                    <span className="shrink-0 text-[12.5px] font-bold text-[color:var(--color-import)]">
                      {importWindow ?? "—"}
                    </span>
                  </div>

                  <p className="bg-white px-3 py-2 text-[11.5px] leading-snug text-[color:var(--color-ink-muted)]">
                    {t("cart.trackedSeparately")}
                  </p>
                </div>
              ) : slowest > 0 ? (
                <p className="mt-2 text-[12px] text-[color:var(--color-ink-muted)]">
                  {t("cart.everythingWithin")}{" "}
                  <span className="font-bold text-[color:var(--color-ink)]">{t("cart.daysUnit", { count: slowest })}</span>.
                </p>
              ) : null}

              <Button size="lg" className="mt-3 w-full" onClick={() => router.push("/checkout")}>
                {t("cart.checkoutShort")}
              </Button>

              <Link
                href="/shop"
                prefetch={false}
                className="mt-2 block text-center text-[13px] font-semibold text-[color:var(--color-brand)] hover:underline"
              >
                {t("cart.keepShopping")}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </SiteChrome>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[color:var(--color-ink-muted)]">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick(): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-full w-10 items-center justify-center text-[16px] font-bold disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function CartIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2.2l2.3 11.2a2 2 0 002 1.6h7.6a2 2 0 002-1.55L21 8H6.2" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  );
}
