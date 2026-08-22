"use client";

import { BRAND } from "@/lib/brand";
import { useT, type Translate } from "@/lib/i18n";
import type { Sourcing } from "@/lib/types";
import { ClockIcon, GlobeIcon, PinIcon, PlaneIcon, ShipIcon, TruckIcon } from "./icons";

/**
 * The sourcing copy, said in the reader's language.
 *
 * The API sends these three lines already written — "In Tanzania",
 * "Available in Tanzania", "In stock locally and ready to ship." — which is
 * fine while the storefront is English and wrong the moment it is not: the
 * page around them would turn Kiswahili and they would not.
 *
 * Every one of them is derivable from structured fields the same payload
 * already carries (`is_local`, `origin`, `lead_time.min/max`,
 * `shipping_method.code`), so they are rebuilt here rather than translated on
 * the server. That keeps the API contract untouched — no deployment is needed
 * for the storefront to speak a new language — and the server's own string
 * stays as the fallback if a shape ever turns up that this does not know.
 */
export function sourcingCopy(sourcing: Sourcing, tr: Translate) {
  const label = sourcing.is_local
    ? tr("product.sourceLabelLocal", { country: sourcing.destination?.name ?? BRAND.country })
    : tr("product.sourceLabelImport");

  const headline = sourcing.is_local
    ? tr("product.headlineLocal", { country: sourcing.destination?.name ?? BRAND.country })
    : sourcing.origin
      ? tr("product.headlineFrom", { country: sourcing.origin.name })
      : tr("product.headlineIntl");

  const summary = sourcing.is_local
    ? tr("product.summaryLocal")
    : tr("product.summaryImport");

  return { label, headline, summary };
}

/** "1–3 days" / "3 days" / "1 day", from the numbers rather than the string. */
export function leadTimeLabel(lead: Sourcing["lead_time"], tr: Translate): string {
  if (lead.min !== lead.max) return tr("product.daysRange", { min: lead.min, max: lead.max });
  return lead.min === 1 ? tr("product.dayOne") : tr("product.daysExact", { count: lead.min });
}

/** The freight mode, keyed off its code so the server's English is not shown. */
export function shippingMethodLabel(
  method: NonNullable<Sourcing["shipping_method"]>,
  tr: Translate,
): string {
  if (method.code === "air") return tr("product.methodAir");
  if (method.code === "sea") return tr("product.methodSea");
  if (method.code === "road") return tr("product.methodRoad");
  return method.label;
}

/* ==========================================================================
   Where is it, and when do I get it?

   The single question 2KONECT exists to answer, so it gets one component
   family used by every surface: the card, the listing, the product page, the
   cart and the checkout all render the same words from the same payload. A
   shopper should never have to work out which kind of purchase they are
   making — it should be the first thing they see.
   ========================================================================== */

/** The tone each availability type carries, everywhere. */
function tone(sourcing: Sourcing) {
  return sourcing.is_local
    ? {
        text: "text-[color:var(--color-local)]",
        soft: "bg-[color:var(--color-local-soft)]",
        line: "border-[color:var(--color-local-line)]",
      }
    : {
        text: "text-[color:var(--color-import)]",
        soft: "bg-[color:var(--color-import-soft)]",
        line: "border-[color:var(--color-import-line)]",
      };
}

/** The transit glyph, chosen from how the shipment actually travels. */
function TransitIcon({ sourcing, className }: { sourcing: Sourcing; className?: string }) {
  if (sourcing.is_local) return <TruckIcon className={className} />;

  switch (sourcing.shipping_method?.code) {
    case "sea":
      return <ShipIcon className={className} />;
    case "road":
      return <TruckIcon className={className} />;
    case "air":
      return <PlaneIcon className={className} />;
    default:
      return <GlobeIcon className={className} />;
  }
}

/**
 * The strip across the top of a product card's details block.
 *
 * Where it is and when it lands, on one tinted full-width row directly under
 * the photograph. It is deliberately the loudest thing in the block after the
 * price: in a grid of twenty otherwise identical listings, this is the field
 * that changes the decision.
 */
export function AvailabilityStrip({
  sourcing,
  className = "",
}: {
  sourcing: Sourcing;
  className?: string;
}) {
  const tr = useT();
  const t = tone(sourcing);

  return (
    <p
      className={`flex items-center gap-1.5 border-y ${t.line} ${t.soft} px-2.5 py-[7px] text-[11px] font-bold leading-none ${t.text} ${className}`}
    >
      {/* An import names the country it is coming from rather than repeating
          "Order from abroad" — it is shorter, so it survives a 164px card
          without an ellipsis, and it is strictly more information. The long
          form still leads the product page, where there is room for it. */}
      <span aria-hidden="true" className="text-[12px] leading-none">
        {sourcing.is_local
          ? sourcing.destination?.flag ?? "🇹🇿"
          : sourcing.origin?.flag ?? "🌍"}
      </span>
      <span className="truncate">
        {sourcing.is_local ? sourcingCopy(sourcing, tr).label : sourcing.origin?.name ?? sourcingCopy(sourcing, tr).label}
      </span>
      <span aria-hidden="true" className="opacity-40">·</span>
      <span className="shrink-0 whitespace-nowrap font-semibold">
        {leadTimeLabel(sourcing.lead_time, tr)}
      </span>
    </p>
  );
}

/**
 * The compact badge.
 *
 * Used where the strip would be too heavy — a cart line, an order item — and
 * the surrounding row already carries its own structure.
 */
export function AvailabilityBadge({
  sourcing,
  size = "md",
  className = "",
}: {
  sourcing: Sourcing;
  size?: "sm" | "md";
  className?: string;
}) {
  const tr = useT();
  const t = tone(sourcing);
  const text = size === "sm" ? "text-[10px]" : "text-[11px]";

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-[var(--radius-xs)] border ${t.line} ${t.soft} px-1.5 py-[3px] ${text} font-bold leading-none ${t.text} ${className}`}
    >
      <span aria-hidden="true" className="text-[11px] leading-none">
        {sourcing.is_local ? sourcing.destination?.flag ?? "🇹🇿" : "🌍"}
      </span>
      <span className="truncate">{sourcingCopy(sourcing, tr).label}</span>
    </span>
  );
}

/**
 * The delivery promise, as a line of text.
 *
 * Deliberately separate from the badge: the badge answers "where", this
 * answers "when", and on a narrow card they need to be able to wrap apart.
 */
export function DeliveryEstimate({
  sourcing,
  size = "md",
  className = "",
}: {
  sourcing: Sourcing;
  size?: "sm" | "md";
  className?: string;
}) {
  const tr = useT();
  const text = size === "sm" ? "text-[10px]" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1 ${text} font-semibold text-[color:var(--color-ink-muted)] ${className}`}
    >
      <ClockIcon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span>
        {sourcing.is_local ? tr("product.delivery") : tr("product.arrives")} {leadTimeLabel(sourcing.lead_time, tr)}
      </span>
    </span>
  );
}

/**
 * The full block on a product page.
 *
 * Answers all four questions at once — where it is, how it travels, when it
 * lands, and what happens after payment — rather than scattering them through
 * the page in small type.
 */
export function AvailabilityPanel({
  sourcing,
  inStock,
  stock,
  className = "",
}: {
  sourcing: Sourcing;
  inStock: boolean;
  stock: number;
  className?: string;
}) {
  const tr = useT();
  const t = tone(sourcing);
  const local = sourcing.is_local;

  return (
    <section
      aria-label={tr("product.availabilityAndDelivery")}
      className={`overflow-hidden rounded-[var(--radius-md)] border ${t.line} ${t.soft} ${className}`}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-white ${t.text} shadow-[var(--shadow-card)]`}
        >
          <TransitIcon sourcing={sourcing} className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className={`flex flex-wrap items-center gap-1.5 text-[15px] font-extrabold ${t.text}`}>
            <span aria-hidden="true">{local ? sourcing.destination?.flag ?? "🇹🇿" : sourcing.origin?.flag ?? "🌍"}</span>
            {sourcingCopy(sourcing, tr).headline}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-[color:var(--color-ink-soft)]">
            {sourcingCopy(sourcing, tr).summary}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px border-t border-white/70 bg-white/70 text-[12px]">
        <Fact
          label={local ? tr("product.deliveryTime") : tr("product.estimatedArrival")}
          value={leadTimeLabel(sourcing.lead_time, tr)}
          icon={<ClockIcon className="h-3.5 w-3.5" />}
        />

        {local ? (
          <Fact
            label={tr("product.stock")}
            value={
              inStock
                ? stock <= 5
                  ? tr("product.onlyLeftShort", { count: stock })
                  : tr("product.inStock")
                : tr("product.outOfStock")
            }
            icon={<PinIcon className="h-3.5 w-3.5" />}
            emphasis={!inStock ? "warn" : undefined}
          />
        ) : (
          <Fact
            label={tr("product.shipsFrom")}
            value={sourcing.origin ? `${sourcing.origin.flag} ${sourcing.origin.name}` : tr("product.international")}
            icon={<GlobeIcon className="h-3.5 w-3.5" />}
          />
        )}

        {!local && sourcing.shipping_method ? (
          <Fact
            label={tr("product.method")}
            value={shippingMethodLabel(sourcing.shipping_method, tr)}
            icon={<TransitIcon sourcing={sourcing} className="h-3.5 w-3.5" />}
          />
        ) : null}

        {sourcing.fulfilment_location ? (
          <Fact
            label={local ? tr("product.shipsFrom") : tr("product.deliveredFrom")}
            value={sourcing.fulfilment_location}
            icon={<PinIcon className="h-3.5 w-3.5" />}
          />
        ) : null}
      </dl>

      {/* What happens after payment. An import is an unfamiliar purchase, so


          the steps are spelled out rather than left to be discovered. */}
      <p className="border-t border-white/70 bg-white/70 px-4 py-2.5 text-[12px] leading-relaxed text-[color:var(--color-ink-muted)]">
        {local
          ? tr("product.localAfterPay")
          : tr("product.importAfterPay", { country: sourcing.destination?.name ?? BRAND.country })}
      </p>
    </section>
  );
}

function Fact({
  label,
  value,
  icon,
  emphasis,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  emphasis?: "warn";
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-2.5">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-faint)]">
        {icon}
        {label}
      </dt>
      <dd
        className={`text-[13px] font-bold ${
          emphasis === "warn" ? "text-[color:var(--color-warn)]" : "text-[color:var(--color-ink)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The origin → destination route, drawn small.
 *
 * Used on the order page and in the cart, where the fact that a package is
 * crossing a border is the most useful thing to show.
 */
export function RouteLine({
  from,
  to,
  className = "",
}: {
  from: { flag: string; name: string } | null;
  to: { flag: string; name: string } | null;
  className?: string;
}) {
  if (!from || !to) return null;

  return (
    <span className={`inline-flex items-center gap-2 text-[13px] font-semibold ${className}`}>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden="true">{from.flag}</span>
        {from.name}
      </span>
      <span aria-hidden="true" className="h-px w-6 bg-current opacity-30" />
      <span className="inline-flex items-center gap-1">
        <span aria-hidden="true">{to.flag}</span>
        {to.name}
      </span>
    </span>
  );
}
