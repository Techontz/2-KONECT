"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Button, EmptyState } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

const DELIVERY_FEE = 3000; // Matches OrderController::DELIVERY_FEE.

/**
 * Cart.
 *
 * Fully usable signed-out — a visitor can review and adjust their basket
 * before ever being asked who they are. Authentication happens one step later,
 * at checkout.
 */
export default function CartPage() {
  const t = useT();
  const cart = useCart();
  const wishlist = useWishlist();
  const router = useRouter();

  if (cart.ready && cart.lines.length === 0) {
    return (
      <SiteChrome>
        <EmptyState
          icon={<CartIcon className="h-9 w-9" />}
          title={t("cart.empty")}
          message="Browse the marketplace and add something you like — no account needed."
          action={<Link href="/"><Button size="lg">{t("cart.startShopping")}</Button></Link>}
        />
      </SiteChrome>
    );
  }

  const total = cart.subtotal + (cart.lines.length ? DELIVERY_FEE : 0);

  return (
    <SiteChrome>
      <div className="shell py-4">
        <h1 className="mb-4 text-[22px] font-extrabold tracking-tight md:text-[26px]">
          Cart <span className="text-[color:var(--color-ink-muted)]">({cart.count})</span>
        </h1>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-3">
            {cart.lines.map(({ product, quantity }) => (
              <article
                key={product.id}
                className="flex gap-3 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-3"
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

                  {product.vendor ? (
                    <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-faint)]">
                      {t("product.soldBy")} {product.vendor.name}
                    </p>
                  ) : null}

                  {product.stock > 0 && product.stock <= 5 ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--color-warn)]">
                      Only {product.stock} left
                    </p>
                  ) : null}

                  <p className="mt-1 text-[16px] font-extrabold">{formatMoney(product.price.current)}</p>

                  {/* The stepper has a fixed width and the actions have long
                      labels, so they wrap to their own run on a narrow card
                      rather than being squeezed off the row. */}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex h-9 items-center rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)]">
                      <StepButton label={t("common.decreaseQuantity")} onClick={() => cart.setQuantity(product.id, quantity - 1)}>
                        −
                      </StepButton>
                      <span className="w-9 text-center text-[13px] font-bold tabular-nums">{quantity}</span>
                      <StepButton
                        label={t("common.increaseQuantity")}
                        disabled={quantity >= product.stock}
                        onClick={() => cart.setQuantity(product.id, quantity + 1)}
                      >
                        +
                      </StepButton>
                    </div>

                    <div className="flex items-center gap-3 text-[12px] font-semibold">
                      <button
                        type="button"
                        onClick={() => { void wishlist.toggle(product.id); cart.remove(product.id); }}
                        className="text-[color:var(--color-action)] hover:underline"
                      >
                        Move to wishlist
                      </button>
                      <button
                        type="button"
                        onClick={() => cart.remove(product.id)}
                        className="text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-sale)] hover:underline"
                      >
                        {t("common.remove")}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>

          {/* ---- summary ---- */}
          <aside className="lg:sticky lg:top-[calc(var(--header-height)+16px)] lg:self-start">
            <div className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
              <h2 className="mb-3 text-[15px] font-extrabold">{t("cart.orderSummary")}</h2>

              <dl className="space-y-2 text-[13px]">
                <SummaryRow
                  label={`${t("cart.subtotal")} (${
                    cart.count === 1 ? t("cart.itemCountOne") : t("cart.itemCount", { count: cart.count })
                  })`}
                  value={formatMoney(cart.subtotal)}
                />
                <SummaryRow label={t("cart.delivery")} value={formatMoney(DELIVERY_FEE)} />
              </dl>

              <div className="mt-3 flex items-baseline justify-between border-t border-[color:var(--color-line)] pt-3">
                <span className="text-[15px] font-extrabold">{t("cart.total")}</span>
                <span className="text-[20px] font-black">{formatMoney(total)}</span>
              </div>

              <Button size="lg" className="mt-4 w-full" onClick={() => router.push("/checkout")}>
                {t("cart.checkout")}
              </Button>

              <p className="mt-2 text-center text-[11px] text-[color:var(--color-ink-faint)]">
                You'll be asked to sign in at checkout
              </p>

              <Link
                href="/"
                className="mt-3 block text-center text-[13px] font-semibold text-[color:var(--color-action)] hover:underline"
              >
                {t("cart.continueShopping")}
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
      <dd className="shrink-0 font-semibold">{value}</dd>
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
      className="flex h-full w-9 items-center justify-center text-base font-bold transition-colors hover:bg-[color:var(--color-surface-alt)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function CartIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" />
      <path d="M2 3h3l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L22 7H6" />
    </svg>
  );
}
