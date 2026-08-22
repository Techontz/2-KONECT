"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import shop from "@/lib/shop";
import type { Address as AddressType } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { useHydrated } from "@/lib/useHydrated";
import { lineSourcing, unitPrice, useCart, keyOf } from "@/lib/store/cart";
import { useLocation } from "@/lib/store/location";
import { LocationPicker } from "@/components/location/LocationPicker";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { AvailabilityBadge } from "@/components/sourcing/Availability";
import { ClockIcon, LockIcon } from "@/components/sourcing/icons";
import { Button, ButtonLink, EmptyState, Notice } from "@/components/ui/Primitives";

/** Matches OrderController::DELIVERY_FEE. */
const DELIVERY_FEE = 3000;

/**
 * Checkout — the point at which the storefront asks who the shopper is.
 *
 * Everything before this is open. Here `requireAuth()` opens the login sheet;
 * dismissing it leaves the cart untouched so nothing is lost by declining.
 *
 * The one thing this page must never do is let somebody pay without knowing
 * when their order arrives. Every line states its own date, and the summary
 * states the date by which the whole order will have landed.
 */
export default function CheckoutPage() {
  return (
    <SiteChrome>
      <CheckoutContent />
    </SiteChrome>
  );
}

function CheckoutContent() {
  const { user, isAuthenticated, ready, requireAuth } = useAuth();
  const hydrated = useHydrated();
  const cart = useCart();
  const router = useRouter();
  const { location: pinned, setLocation } = useLocation();

  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState<AddressType[]>([]);
  // `null` means "type a different address", so an explicit choice to enter a
  // one-off destination is not overwritten when the saved list arrives.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  // Only cash on delivery is connected. Mobile money is shown but cannot be
  // selected, because pretending an unintegrated provider took the money would
  // create an order nobody has actually paid for.
  const payment = "cash_on_delivery" as const;
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ask for credentials as soon as the shopper lands here, not before.
  useEffect(() => {
    if (ready && !isAuthenticated) void requireAuth();
  }, [ready, isAuthenticated, requireAuth]);

  useEffect(() => {
    if (user?.phone && !phone) setPhone(user.phone);
  }, [user, phone]);

  // Pull the address book once signed in and preselect the default, so the
  // common case is one click rather than retyping a known address.
  useEffect(() => {
    if (!ready || !isAuthenticated) return;

    let cancelled = false;

    shop
      .addresses()
      .then((list) => {
        if (cancelled || list.length === 0) return;
        setSaved(list);
        const preferred = list.find((item) => item.is_default) ?? list[0];
        setSelectedId(preferred.id);
        setAddress(preferred.formatted);
        if (preferred.phone) setPhone(preferred.phone);
      })
      .catch(() => {
        // A failure here is not fatal: the manual fields still work.
      });

    return () => { cancelled = true; };
  }, [ready, isAuthenticated]);

  // A location chosen in the header should already be filled in when the
  // shopper reaches checkout, rather than being asked for twice.
  useEffect(() => {
    if (pinned && !address && selectedId === null) {
      setAddress(pinned.formatted);
    }
  }, [pinned, address, selectedId]);

  function chooseAddress(item: AddressType) {
    setSelectedId(item.id);
    setAddress(item.formatted);
    if (item.phone) setPhone(item.phone);
  }

  const total = cart.subtotal + (cart.lines.length ? DELIVERY_FEE : 0);

  // The order is complete when its slowest line lands, so that is the date
  // the summary promises — never an average that no line actually meets.
  const slowest = cart.lines.reduce(
    (max, line) => Math.max(max, lineSourcing(line)?.lead_time.max ?? 0),
    0,
  );
  const importCount = cart.lines.filter((line) => lineSourcing(line)?.is_local === false).length;

  if (cart.ready && cart.lines.length === 0) {
    return (
      <EmptyState
        title="There is nothing to check out"
        message="Your cart is empty. Add something first."
        action={<ButtonLink href="/shop" size="lg">Browse products</ButtonLink>}
      />
    );
  }

  if (hydrated && ready && !isAuthenticated) {
    return (
      <EmptyState
        title="Sign in to place your order"
        message="Your cart is saved — signing in only takes a moment and lets you track the order afterwards."
        action={<Button size="lg" onClick={() => void requireAuth()}>Sign in to continue</Button>}
      />
    );
  }

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();

    // Guard the action itself as well as the page: a session can expire while
    // the shopper is filling the form in.
    if (!(await requireAuth())) return;

    setPlacing(true);
    setError(null);

    try {
      const result = await shop.placeOrder({
        items: cart.lines.map((line) => ({
          product_id: line.product.id,
          quantity: line.quantity,
          // Which way they chose to buy it. The server prices and dates the
          // line from this, so what was promised here is what gets recorded.
          offer_id: line.option?.id ?? null,
          // Which combination, when the product sells by option. The server
          // re-resolves the price and the stock behind it either way.
          variant_id: line.variant?.id ?? null,
        })),
        delivery_address: address.trim(),
        customer_phone: phone.trim(),
        payment_method: payment,
      });

      cart.clear();
      router.push(`/account/orders/${encodeURIComponent(result.reference)}?placed=1`);
    } catch (err) {
      setError(apiError(err, "We couldn’t place your order. Please try again."));
      setPlacing(false);
    }
  }

  return (
    <div className="shell py-4 pb-tabbar">
      <h1 className="mb-4 text-[22px] font-black tracking-[-0.02em] md:text-[28px]">Checkout</h1>

      <form onSubmit={placeOrder} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_356px]">
        <div className="space-y-3">
          {/* ---- delivery ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-black">Delivery details</h2>
              <Link
                href="/account/addresses"
                className="text-[12px] font-bold text-[color:var(--color-brand)] hover:underline"
              >
                Manage addresses
              </Link>
            </div>

            {saved.length > 0 ? (
              <fieldset className="mb-3">
                <legend className="mb-2 text-[12px] font-bold text-[color:var(--color-ink-muted)]">
                  Deliver to
                </legend>

                <div className="grid gap-2 sm:grid-cols-2">
                  {saved.map((item) => (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer gap-2 rounded-[var(--radius-sm)] p-3 text-left ${
                        selectedId === item.id
                          ? "ring-2 ring-[color:var(--color-brand)]"
                          : "ring-1 ring-[color:var(--color-line)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="saved-address"
                        className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
                        checked={selectedId === item.id}
                        onChange={() => chooseAddress(item)}
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1">
                          <span className="text-[13px] font-extrabold">{item.full_name}</span>
                          {item.is_default ? (
                            <span className="rounded-full bg-[color:var(--color-brand-100)] px-[6px] py-[1px] text-[9px] font-black uppercase text-[color:var(--color-brand)]">
                              Default
                            </span>
                          ) : null}
                        </span>
                        <span className="clamp-2 block text-[12px] text-[color:var(--color-ink-muted)]">
                          {item.formatted}
                        </span>
                      </span>
                    </label>
                  ))}

                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] p-3 ${
                      selectedId === null
                        ? "ring-2 ring-[color:var(--color-brand)]"
                        : "ring-1 ring-[color:var(--color-line)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="saved-address"
                      className="h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
                      checked={selectedId === null}
                      onChange={() => { setSelectedId(null); setAddress(""); }}
                    />
                    <span className="text-[13px] font-semibold">Deliver somewhere else</span>
                  </label>
                </div>
              </fieldset>
            ) : null}

            <div className="space-y-3">
              <Field
                label="Delivery address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
                placeholder="Street, area, landmark — anything a rider needs to find you"
                multiline
              />
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-2 text-[13px] font-bold text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-50)]"
              >
                <MapPinIcon className="h-4 w-4 shrink-0" />
                {address.trim() ? "Change location on map" : "Pick on map"}
              </button>

              <Field
                label="Phone number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                inputMode="tel"
                placeholder="07XX XXX XXX"
              />
            </div>
          </section>

          {/* ---- payment ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <h2 className="mb-3 text-[15px] font-black">Payment</h2>

            <div className="space-y-2">
              <PaymentOption
                checked
                title="Cash on delivery"
                body="Pay the rider when your order reaches you."
              />

              {/* Shown so shoppers know these are coming, but not selectable —
                  there is no integration behind either yet, and a checkout that
                  pretends otherwise creates an order nobody has paid for. */}
              <PaymentOption
                unavailable
                title="Lipa Namba"
                body="Pay directly to the 2KONECT till number."
                badge="Coming soon"
              />

              <PaymentOption
                unavailable
                title="Mobile money"
                body="Pay from your mobile wallet at checkout."
                badge="Coming soon"
              >
                <span className="mt-2 flex flex-wrap gap-2">
                  {["M-Pesa", "Tigo Pesa", "Airtel Money", "HaloPesa"].map((option) => (
                    <span
                      key={option}
                      className="rounded-[var(--radius-sm)] border border-[color:var(--color-line)] px-2.5 py-1 text-[12px] font-semibold text-[color:var(--color-ink-faint)]"
                    >
                      {option}
                    </span>
                  ))}
                </span>
              </PaymentOption>
            </div>

            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[color:var(--color-ink-muted)]">
              <LockIcon className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[color:var(--color-brand)]" />
              Online payment methods are being connected. Until then, orders are placed
              on cash on delivery so nothing is charged before you receive it.
            </p>
          </section>

          {/* ---- items, each with its own arrival ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <h2 className="mb-3 text-[15px] font-black">
              Your items ({cart.count})
            </h2>
            <ul className="divide-y divide-[color:var(--color-line)]">
              {cart.lines.map((line) => {
                const sourcing = lineSourcing(line);

                return (
                  <li key={keyOf(line)} className="flex items-start gap-3 py-3">
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-white ring-1 ring-[color:var(--color-line)]">
                      {line.product.image ? (
                        <img src={line.product.image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="clamp-2 block text-[13px] font-semibold">{line.product.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        {sourcing ? <AvailabilityBadge sourcing={sourcing} size="sm" /> : null}
                        <span className="text-[11px] text-[color:var(--color-ink-muted)]">
                          Qty {line.quantity}
                        </span>
                      </span>
                      {sourcing ? (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[color:var(--color-ink-soft)]">
                          <ClockIcon className="h-3 w-3" />
                          {sourcing.is_local ? "Delivered in" : "Arrives in"} {sourcing.lead_time.label}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[14px] font-bold">
                      {formatMoney(unitPrice(line) * line.quantity)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* ---- summary ---- */}
        <aside className="lg:sticky lg:top-[calc(var(--header-height)+16px)] lg:self-start">
          <div className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <h2 className="mb-3 text-[15px] font-black">Summary</h2>

            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--color-ink-muted)]">Subtotal</dt>
                <dd className="font-semibold">{formatMoney(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--color-ink-muted)]">Delivery</dt>
                <dd className="font-semibold">{formatMoney(DELIVERY_FEE)}</dd>
              </div>
            </dl>

            <div className="mt-3 flex items-baseline justify-between border-t border-[color:var(--color-line)] pt-3">
              <span className="text-[15px] font-black">Total</span>
              <span className="text-[22px] font-black tracking-[-0.02em]">{formatMoney(total)}</span>
            </div>

            {/* The promise, stated before the button rather than after the
                payment. Nobody should have to guess when their order lands. */}
            {slowest > 0 ? (
              <div className="mt-3 rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
                  Estimated arrival
                </p>
                <p className="mt-0.5 text-[15px] font-black">by {arrivalDate(slowest)}</p>
                <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                  {importCount > 0 && importCount < cart.lines.length
                    ? "Local items arrive sooner — you can track each part separately."
                    : importCount > 0
                      ? "We import it, clear it and deliver it. You can follow every step."
                      : "Delivered to your address across Dar es Salaam."}
                </p>
              </div>
            ) : null}

            {error ? <Notice tone="danger" className="mt-3">{error}</Notice> : null}

            <Button type="submit" size="lg" className="mt-3 w-full" loading={placing}>
              {placing ? "Placing your order" : "Place order"}
            </Button>

            <p className="mt-2 text-center text-[11px] leading-relaxed text-[color:var(--color-ink-faint)]">
              By placing this order you agree to {BRAND.name}’s{" "}
              <Link href="/legal/terms" className="underline">terms</Link>.
            </p>
          </div>
        </aside>
      </form>

      <LocationPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onConfirm={(picked) => {
          // Writing to the shared store as well keeps the header's "Deliver to"
          // and the checkout address from drifting apart.
          setLocation(picked);
          setAddress(picked.formatted);
          setSelectedId(null);
        }}
      />
    </div>
  );
}

/** "12 September 2026", `days` from today. */
function arrivalDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * A payment method row.
 *
 * `unavailable` renders the method as visibly present but plainly inactive —
 * dimmed, not selectable, and labelled with why. Shoppers can see what is
 * coming without the interface implying they can pay with it.
 */
function PaymentOption({
  checked = false,
  onSelect,
  title,
  body,
  badge,
  unavailable = false,
  children,
}: {
  checked?: boolean;
  onSelect?(): void;
  title: string;
  body: string;
  badge?: string;
  unavailable?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <label
      aria-disabled={unavailable}
      className={`flex gap-3 rounded-[var(--radius-sm)] border p-3 transition-colors ${
        unavailable
          ? "cursor-not-allowed border-[color:var(--color-line)] bg-[color:var(--color-surface-alt)]"
          : checked
            ? "cursor-pointer border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)]"
            : "cursor-pointer border-[color:var(--color-line-strong)] hover:border-[color:var(--color-ink-faint)]"
      }`}
    >
      <input
        type="radio"
        name="payment"
        checked={checked}
        disabled={unavailable}
        onChange={onSelect}
        // The one live method is fixed rather than chosen, so it is a
        // read-only control instead of a checkbox React will warn about.
        readOnly={!onSelect}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-[14px] font-bold ${unavailable ? "text-[color:var(--color-ink-muted)]" : ""}`}>
            {title}
          </span>
          {badge ? (
            <span className="rounded-full bg-[color:var(--color-warn-soft)] px-2 py-[2px] text-[10px] font-black uppercase tracking-wide text-[color:var(--color-warn)]">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="block text-[12px] text-[color:var(--color-ink-muted)]">{body}</span>
        {children}
      </span>
    </label>
  );
}

function Field({
  label,
  multiline,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; multiline?: boolean }) {
  const className =
    "w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-2.5 text-[15px] outline-none transition-colors focus:border-[color:var(--color-brand)] focus:ring-2 focus:ring-[color:var(--color-brand-200)]";

  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold">{label}</span>
      {multiline ? (
        <textarea
          {...(props as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          rows={3}
          className={`${className} resize-y`}
        />
      ) : (
        <input {...props} className={`${className} h-12`} />
      )}
    </label>
  );
}

function MapPinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
