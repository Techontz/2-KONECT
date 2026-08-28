"use client";

import { useT } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { apiError } from "@/lib/api";
import { createCheckoutSession, paymentOptions, type PaymentOptions } from "@/lib/payments";
import { AddressForm } from "@/components/account/AddressForm";
import { BRAND } from "@/lib/brand";
import { formatMoney } from "@/lib/format";
import shop from "@/lib/shop";
import type { Address as AddressType } from "@/lib/types";
import { useAuth } from "@/lib/store/auth";
import { useHydrated } from "@/lib/useHydrated";
import { lineSourcing, unitPrice, useCart, keyOf } from "@/lib/store/cart";
import { useCurrency } from "@/lib/store/currency";
import { useLocation } from "@/lib/store/location";
import { LocationPicker } from "@/components/location/LocationPicker";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { AvailabilityBadge } from "@/components/sourcing/Availability";
import { ClockIcon, LockIcon } from "@/components/sourcing/icons";
import { Button, ButtonLink, EmptyState, Notice } from "@/components/ui/Primitives";

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
  const t = useT();
  const { user, isAuthenticated, ready, requireAuth } = useAuth();
  const hydrated = useHydrated();
  const cart = useCart();
  const router = useRouter();
  const { location: pinned, setLocation } = useLocation();
  const { currency } = useCurrency();

  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState<AddressType[]>([]);
  // Bumped whenever an address is saved here. An address-book read that was
  // already in flight when that happened is discarded rather than applied —
  // otherwise a slow GET can quietly reinstate the list from before the save.
  const bookVersion = useRef(0);
  // `null` means "type a different address", so an explicit choice to enter a
  // one-off destination is not overwritten when the saved list arrives.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  // What this basket may be paid with is decided by the server, because it
  // depends on what is in it: anything sourced from abroad is prepaid. The
  // page asks, renders the answer, and the same rule is applied again when the
  // order is placed — so this is presentation, not permission.
  const [options, setOptions] = useState<PaymentOptions | null>(null);
  const [payment, setPayment] = useState<string>("cash_on_delivery");
  // Anything from abroad makes the whole basket prepaid, and takes delivery
  // out of this checkout entirely — see the note by the summary below.
  const hasImport = cart.lines.some((line) => lineSourcing(line)?.is_local === false);

  const [placing, setPlacing] = useState(false);
  // Which step of a card checkout we are on, so the button can say what is
  // actually happening rather than spinning silently through two round trips
  // and a redirect.
  const [phase, setPhase] = useState<"placing" | "session" | "redirecting" | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  // The saved address currently open for editing, if any.
  const [editing, setEditing] = useState<AddressType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The channel the shopper has actually chosen, and whether paying it means
  // leaving the site. Read from the server's own `is_gateway` flag, never from
  // the code string — a second gateway later must not need a frontend release.
  const selectedChannel = options?.channels.find((channel) => channel.code === payment) ?? null;
  const isGateway = selectedChannel?.is_gateway === true;

  // Paying by card means leaving the site, and coming back to an order that is
  // already real. A typed line of free text is enough to deliver a cash order
  // that a rider can ask about at the door; it is not enough to send somebody
  // to a payment page. So a card checkout requires a structured address —
  // chosen from the book or saved during checkout — with a name and a phone
  // number a courier can actually use.
  //
  // Deliberately scoped to gateway channels. Cash on delivery and every
  // manual channel keep the free-text field they have always had.
  const structuredAddress = selectedId !== null
    ? saved.find((item) => item.id === selectedId) ?? null
    : null;
  const needsStructuredAddress = isGateway && structuredAddress === null;

  /**
   * Whether this order can be paid for at all.
   *
   * Only genuinely required things. A card checkout needs an address a courier
   * can be sent to; every checkout needs somewhere to deliver, a number to
   * ring, something in the basket and a method the server actually offered.
   * Nothing here asks for a channel by name — a checkout must never be held up
   * waiting for a payment method that is no longer switched on.
   */
  const hasDeliveryTarget = isGateway ? structuredAddress !== null : address.trim() !== "";
  const canPay =
    !placing &&
    cart.lines.length > 0 &&
    hasDeliveryTarget &&
    phone.trim() !== "" &&
    // The server decides what is on offer; an empty string means it named
    // nothing, and there is then nothing to press.
    payment !== "";

  useEffect(() => {
    let live = true;

    paymentOptions(hasImport)
      .then((next) => {
        if (!live) return;
        setOptions(next);
        // Default to the first thing that is actually offered. A prepaid
        // basket has no cash-on-delivery entry to fall back to.
        setPayment(next.cash_on_delivery ? "cash_on_delivery" : next.channels[0]?.code ?? "");
      })
      .catch(() => undefined);

    return () => { live = false; };
  }, [hasImport]);

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
    // What the book looked like when this request left. If anything is saved
    // while it is in flight, the answer it eventually brings back is older
    // than what the shopper is looking at, and must not be written.
    const startedAt = bookVersion.current;

    shop
      .addresses()
      .then((list) => {
        if (cancelled || bookVersion.current !== startedAt) return;

        // Written even when empty. Returning early here meant a shopper who
        // had deleted every address kept seeing the old ones until reload.
        setSaved(list);

        if (list.length === 0) return;

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

  /**
   * Adopt what the server just wrote, and make any older read stale.
   *
   * Both the add and the edit paths end here, so there is one rule about which
   * address ends up selected rather than two that can drift. Bumping the
   * version is what stops a slow GET issued before the save from landing
   * afterwards and replacing the new address with the list that predates it.
   *
   * `address` is the row the server says it wrote. Falling back to the book is
   * only for an older API that does not return it; the id is never guessed by
   * diffing lists, which is what used to happen and what went wrong whenever
   * the local list was not what the server had.
   */
  function adoptSaved(result: { address: AddressType | null; addresses: AddressType[] }) {
    bookVersion.current += 1;

    setSaved(result.addresses);

    const chosen =
      result.address ??
      result.addresses.find((item) => item.is_default) ??
      result.addresses[0] ??
      null;

    if (chosen) chooseAddress(chosen);
  }


  // The order is complete when its slowest line lands, so that is the date
  // the summary promises — never an average that no line actually meets.
  const slowest = cart.lines.reduce(
    (max, line) => Math.max(max, lineSourcing(line)?.lead_time.max ?? 0),
    0,
  );
  // Nothing is added to the goods. Delivery is settled after the order.
  const total = cart.subtotal;
  const importCount = cart.lines.filter((line) => lineSourcing(line)?.is_local === false).length;

  if (cart.ready && cart.lines.length === 0) {
    return (
      <EmptyState
        title={t("checkout.nothingToCheckout")}
        message={t("checkout.cartEmpty")}
        action={<ButtonLink href="/shop" size="lg">{t("checkout.browseProducts")}</ButtonLink>}
      />
    );
  }

  if (hydrated && ready && !isAuthenticated) {
    return (
      <EmptyState
        title={t("checkout.signInTitle")}
        message={t("checkout.signInHint")}
        action={<Button size="lg" onClick={() => void requireAuth()}>{t("checkout.signInAction")}</Button>}
      />
    );
  }

  /**
   * Place the order, and — when the channel is a gateway — take the shopper
   * straight to it.
   *
   * This used to do the same thing for every channel: create the order, empty
   * the cart, land on the order page. For cash on delivery and the manual
   * channels that is right; for a card it is not. The shopper pressed a button that reads
   * like paying, got a page that reads like a receipt, and the actual payment
   * sat behind a second button further down. Nothing was ever wrongly marked
   * paid — the order is created `awaiting_payment` and only a signed webhook
   * can settle it — but the flow told a story the money did not match.
   *
   * The order still has to exist first: `POST /shop/orders/{ref}/checkout-session`
   * needs a reference to price and attach the payment to. So the fix is to
   * chain the two calls, not to defer creating the order.
   */
  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();

    // A card checkout needs somewhere real to deliver to. Refused before the
    // order is created, so nothing is placed that cannot be fulfilled.
    if (needsStructuredAddress) {
      setError(t("checkout.addressRequiredForCard"));
      return;
    }

    // A second submit must not create a second order. The button is disabled
    // while this runs, but a form can also be submitted with Enter, and a
    // double tap on a slow connection beats a re-render.
    if (placing) return;

    // Guard the action itself as well as the page: a session can expire while
    // the shopper is filling the form in.
    if (!(await requireAuth())) return;

    setPlacing(true);
    setPhase("placing");
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

      const reference = encodeURIComponent(result.reference);

      if (!isGateway) {
        // Unchanged: cash on delivery and every manual channel land on the
        // order, where a till number and a reference field are waiting.
        cart.clear();
        router.push(`/account/orders/${reference}?placed=1`);
        return;
      }

      // ---- card payment ----
      //
      // The order exists and owes money. Ask the server for a hosted Checkout
      // Session and leave. The server prices it from its own rows; this request
      // carries no body, so there is no amount for anyone to tamper with.
      setPhase("session");

      let url: string;
      try {
        url = await createCheckoutSession(result.reference);
      } catch {
        // The order was created but the payment page could not be opened.
        // Never re-submit — that would place a second order. Send the shopper
        // to the order, where the same payment can be retried against the
        // reference that already exists.
        cart.clear();
        router.push(`/account/orders/${reference}?stripe=unavailable`);
        return;
      }

      // Only now is the basket spent: if anything above had failed, the
      // shopper still has their cart.
      cart.clear();
      setPhase("redirecting");
      window.location.assign(url);
    } catch (err) {
      setError(apiError(err, t("checkout.failed")));
      setPlacing(false);
      setPhase(null);
    }
  }

  return (
    <div className="shell py-4 pb-tabbar">
      <h1 className="mb-4 text-[22px] font-black tracking-[-0.02em] md:text-[28px]">{t("checkout.title")}</h1>

      <form onSubmit={placeOrder} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_356px]">
        <div className="space-y-3">
          {/* ---- delivery ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-black">{t("checkout.deliveryDetails")}</h2>
              <Link
                href="/account/addresses"
                className="text-[12px] font-bold text-[color:var(--color-brand)] hover:underline"
              >
                {t("checkout.manageAddresses")}
              </Link>
            </div>

            {saved.length > 0 ? (
              <fieldset className="mb-3">
                <legend className="mb-2 text-[12px] font-bold text-[color:var(--color-ink-muted)]">
                  {t("checkout.deliverTo")}
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

                        {/* Correcting a saved address without losing the
                            basket. Uses the account page's own updateAddress,
                            so there is one address system rather than two. */}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            setAddingAddress(false);
                            setEditing(item);
                          }}
                          className="mt-1 text-[11px] font-bold text-[color:var(--color-brand)] hover:underline"
                        >
                          {t("checkout.editAddress")}
                        </button>
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
                    <span className="text-[13px] font-semibold">{t("checkout.deliverElsewhere")}</span>
                  </label>
                </div>
              </fieldset>
            ) : null}

            {editing ? (
              <div className="mb-3 rounded-[var(--radius-sm)] border border-[color:var(--color-line)] p-3">
                <AddressForm
                  initial={editing}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (values) => {
                    // Stays selected. Correcting a house number should not
                    // quietly change where the order is going.
                    adoptSaved(await shop.updateAddress(editing.id, values));
                    setEditing(null);
                  }}
                />
              </div>
            ) : null}

            {/* Saving an address without leaving checkout. Reuses the account
                page's own form rather than growing a second one that would
                drift from it. */}
            {addingAddress ? (
              <div className="mb-3 rounded-[var(--radius-sm)] border border-[color:var(--color-line)] p-3">
                <AddressForm
                  initial={null}
                  forceDefault={saved.length === 0}
                  onCancel={() => setAddingAddress(false)}
                  onSubmit={async (values) => {
                    // Selected because the server said this is the row it
                    // wrote — not because it is the one missing from a list
                    // this page happened to be holding.
                    adoptSaved(await shop.createAddress(values));
                    setAddingAddress(false);
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setEditing(null); setAddingAddress(true); }}
                className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-line-strong)] px-3 py-2 text-[13px] font-bold text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-50)]"
              >
                + {t("checkout.addNewAddress")}
              </button>
            )}

            <div className="space-y-3">
              <Field
                label={t("checkout.deliveryAddress")}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
                placeholder={t("checkout.addressPlaceholder")}
                multiline
              />
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-2 text-[13px] font-bold text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-50)]"
              >
                <MapPinIcon className="h-4 w-4 shrink-0" />
                {address.trim() ? t("checkout.changeLocation") : t("checkout.pickOnMap")}
              </button>

              <Field
                label={t("checkout.phone")}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                inputMode="tel"
                placeholder={t("checkout.phonePlaceholder")}
              />
            </div>
          </section>

          {/* ---- payment ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <h2 className="text-[15px] font-black">{t("payment.chooseMethod")}</h2>
            <p className="mb-3 mt-1 text-[12px] text-[color:var(--color-ink-muted)]">
              {t("payment.chooseMethodHint")}
            </p>

            {/* What this order type means for when money changes hands, said
                before the options rather than discovered after them. The two
                cases are genuinely different arrangements, not two buttons. */}
            {hasImport ? (
              <Notice tone="warn" className="mb-3">
                <span className="font-bold">🌍 {t("payment.importPrepaidNote")}</span>
                <span className="mt-1 block">
                  {importCount < cart.lines.length
                    ? t("payment.mixedBasketNote")
                    : t("payment.prepaidExplainer")}
                </span>
              </Notice>
            ) : options?.cash_on_delivery ? (
              <Notice tone="info" className="mb-3">
                🇹🇿 {t("payment.localCodNote")}
              </Notice>
            ) : null}

            <div className="space-y-2">
              {/* Cash on delivery appears only when the server says it may.
                  It is never rendered disabled for an import: an option that
                  cannot be chosen is still an option the shopper reads. */}
              {options?.cash_on_delivery ? (
                <PaymentOption
                  checked={payment === "cash_on_delivery"}
                  onSelect={() => setPayment("cash_on_delivery")}
                  title={t("payment.cashOnDelivery")}
                  body={t("payment.cashOnDeliveryHint")}
                />
              ) : null}

              {(options?.channels ?? []).map((channel) => (
                <PaymentOption
                  key={channel.code}
                  checked={payment === channel.code}
                  onSelect={() => setPayment(channel.code)}
                  title={channel.label}
                  // A manual channel's instructions are configuration: the
                  // till number and what to do after paying live on the
                  // server because they change without a release. A gateway
                  // has none of that — nothing to copy, nothing to quote —
                  // so its description is ours to write and to translate.
                  body={channel.is_gateway ? t("payment.gatewayBody") : channel.instructions ?? ""}
                />
              ))}

              {options && !options.cash_on_delivery && options.channels.length === 0 ? (
                <Notice tone="warn">{t("payment.noChannels")}</Notice>
              ) : null}
            </div>

            {hasImport ? (
              <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[color:var(--color-ink-muted)]">
                <LockIcon className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[color:var(--color-brand)]" />
                {t("payment.deliveryNotIncluded", { country: BRAND.country })}
              </p>
            ) : null}
          </section>

          {/* ---- items, each with its own arrival ---- */}
          <section className="rounded-[var(--radius-md)] border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
            <h2 className="mb-3 text-[15px] font-black">
              {t("checkout.yourItemsCount", { count: cart.count })}
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
                          {sourcing.is_local ? t("checkout.deliveredIn") : t("checkout.arrivesIn")} {sourcing.lead_time.label}
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
            <h2 className="mb-3 text-[15px] font-black">{t("checkout.summary")}</h2>

            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--color-ink-muted)]">{t("checkout.subtotal")}</dt>
                <dd className="font-semibold">{formatMoney(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--color-ink-muted)]">{t("checkout.delivery")}</dt>
                <dd className="font-semibold">
                  {hasImport ? t("payment.deliveryNotAdded") : t("payment.deliveryToBeConfirmed")}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex items-baseline justify-between border-t border-[color:var(--color-line)] pt-3">
              <span className="text-[15px] font-black">{t("checkout.total")}</span>
              <span className="text-[22px] font-black tracking-[-0.02em]">{formatMoney(total)}</span>
            </div>

            {/* The promise, stated before the button rather than after the
                payment. Nobody should have to guess when their order lands. */}
            {slowest > 0 ? (
              <div className="mt-3 rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
                  {t("checkout.estimatedArrival")}
                </p>
                <p className="mt-0.5 text-[15px] font-black">{t("checkout.byDate", { date: arrivalDate(slowest) })}</p>
                <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
                  {importCount > 0 && importCount < cart.lines.length
                    ? t("checkout.localSooner")
                    : importCount > 0
                      ? t("checkout.weImportIt")
                      : t("checkout.deliveredAcrossCity", { city: BRAND.city })}
                </p>
              </div>
            ) : null}

            {/* ---- what the card will actually be charged ----
                A shopper reading "$100.00" must not discover at the bank that
                something else was taken. The order is charged in the currency
                it was placed in, which is the one on screen — this states it
                rather than leaving it to be assumed. */}
            {isGateway ? (
              <p className="mt-3 rounded-[var(--radius-sm)] bg-[color:var(--color-brand-50)] px-3 py-2 text-[12px] font-semibold text-[color:var(--color-ink)]">
                {t("payment.chargedIn", { amount: formatMoney(total) })}
                <span className="mt-0.5 block font-normal text-[color:var(--color-ink-muted)]">
                  {t("payment.processedIn", { currency })}
                </span>
              </p>
            ) : null}

            {error ? <Notice tone="danger" className="mt-3">{error}</Notice> : null}

            {/* The label says what the button does. With a card selected it
                leaves the site, and the shopper should know that before they
                press it, not after. */}
            {needsStructuredAddress ? (
              <Notice tone="warn" className="mt-3">
                {t("checkout.addressRequiredForCard")}
              </Notice>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="mt-3 w-full"
              loading={placing}
              disabled={!canPay}
            >
              {phase === "redirecting"
                ? t("checkout.redirectingToStripe")
                : phase === "session"
                  ? t("checkout.preparingPayment")
                  : placing
                    ? t("checkout.placing")
                    : isGateway
                      ? t("checkout.payAndPlaceOrder")
                      : t("checkout.placeOrder")}
            </Button>

            {isGateway && !placing ? (
              <p className="mt-2 flex items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed text-[color:var(--color-ink-muted)]">
                <LockIcon className="mt-[1px] h-3 w-3 shrink-0 text-[color:var(--color-brand)]" />
                {t("checkout.gatewayRedirectNote")}
              </p>
            ) : null}

            <p className="mt-2 text-center text-[11px] leading-relaxed text-[color:var(--color-ink-faint)]">
              {t("checkout.termsPrefix", { brand: BRAND.name })}{" "}
              <Link href="/legal/terms" className="underline">{t("checkout.termsWord", { brand: BRAND.name })}</Link>.
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
