"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useState } from "react";

import { apiError } from "@/lib/api";
import shop from "@/lib/shop";
import { formatMoney } from "@/lib/format";
import type { DeliveryOptions } from "@/lib/types";
import { Button, Notice, Skeleton } from "@/components/ui/Primitives";
import { TruckIcon, WarehouseIcon } from "@/components/sourcing/icons";

/**
 * 2KONECT Rides — asking for the last mile.
 *
 * Opens once a shipment has actually reached Tanzania, which the server
 * decides, not this component: it fetches the options for this specific order
 * and renders what comes back. If the backend says the order has not landed,
 * there is nothing to choose and the sheet says so rather than taking a
 * request it cannot honour.
 */
export function DeliveryRequestForm({
  open,
  onClose,
  orderReference,
  defaultName = "",
  defaultPhone = "",
  defaultAddress = "",
  onDone,
}: {
  open: boolean;
  onClose(): void;
  orderReference: string;
  defaultName?: string;
  defaultPhone?: string;
  defaultAddress?: string;
  onDone(): void;
}) {
  const t = useT();
  const [options, setOptions] = useState<DeliveryOptions | null>(null);
  const [mode, setMode] = useState<"delivery" | "pickup">("delivery");
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [address, setAddress] = useState(defaultAddress);
  const [pickupPoint, setPickupPoint] = useState("");
  const [date, setDate] = useState("");
  const [window_, setWindow] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setOptions(null);

    shop
      .deliveryOptions(orderReference)
      .then((data) => {
        setOptions(data);
        setPickupPoint(data.pickup_points[0]?.name ?? "");
        setWindow(data.windows[0] ?? "");
      })
      .catch((err) => setError(apiError(err, t("delivery.loadFailed"))));
  }, [open, orderReference, t]);

  // The page behind must not scroll while the sheet owns the screen.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fee = options?.modes.find((option) => option.value === mode)?.fee ?? 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await shop.requestDelivery({
        order_reference: orderReference,
        mode,
        recipient_name: name.trim(),
        recipient_phone: phone.trim(),
        address: mode === "delivery" ? address.trim() : undefined,
        pickup_point: mode === "pickup" ? pickupPoint : undefined,
        preferred_date: date || undefined,
        preferred_window: window_ || undefined,
        notes: notes.trim() || undefined,
      });

      onDone();
    } catch (err) {
      setError(apiError(err, t("delivery.arrangeFailed")));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95]" role="dialog" aria-modal="true" aria-label={t("delivery.arrangeDelivery")}>
      <div className="fade-in absolute inset-0 bg-black/55" onClick={onClose} />

      <div className="sheet-up absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-[var(--radius-lg)] bg-white sm:inset-0 sm:m-auto sm:h-fit sm:max-w-lg sm:rounded-[var(--radius-lg)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[color:var(--color-line)] bg-white px-4 py-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-brand)]">
              2KONECT Rides
            </p>
            <h2 className="text-[16px] font-black">{t("delivery.arrangeDelivery")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="-mr-2 flex h-11 w-11 items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {error && !options ? (
          <div className="p-4"><Notice tone="danger">{error}</Notice></div>
        ) : !options ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !options.available ? (
          <div className="p-4">
            <Notice tone="info" title={t("delivery.notThereYet")}>
              This order has not arrived in Tanzania. We will tell you the moment it
              lands, and you can arrange delivery then.
            </Notice>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-4">
            <fieldset>
              <legend className="mb-2 text-[13px] font-bold">{t("delivery.howDoYouWantIt")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {options.modes.map((option) => {
                  const active = mode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      aria-pressed={active}
                      className={`flex flex-col gap-1 rounded-[var(--radius-md)] border-2 p-3 text-left transition-colors ${
                        active
                          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)]"
                          : "border-[color:var(--color-line)] hover:border-[color:var(--color-line-strong)]"
                      }`}
                    >
                      <span className="text-[color:var(--color-brand)]">
                        {option.value === "pickup" ? <WarehouseIcon className="h-5 w-5" /> : <TruckIcon className="h-5 w-5" />}
                      </span>
                      <span className="text-[13px] font-extrabold">{option.label}</span>
                      <span className="text-[12px] text-[color:var(--color-ink-muted)]">{option.note}</span>
                      <span className="text-[12px] font-bold text-[color:var(--color-brand)]">
                        {option.fee > 0 ? formatMoney(option.fee) : "Free"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label={t("delivery.whoReceiving")} value={name} onChange={setName} required placeholder={t("delivery.fullName")} />
              <TextField label={t("delivery.phone")} value={phone} onChange={setPhone} required inputMode="tel" placeholder={t("checkout.phonePlaceholder")} />
            </div>

            {mode === "delivery" ? (
              <TextField
                label={t("delivery.deliveryAddress")}
                value={address}
                onChange={setAddress}
                required
                multiline
                placeholder={t("delivery.addressPlaceholder")}
              />
            ) : (
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-bold">{t("delivery.collectFrom")}</span>
                <select
                  value={pickupPoint}
                  onChange={(event) => setPickupPoint(event.target.value)}
                  className="h-12 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[15px] outline-none focus:border-[color:var(--color-brand)]"
                >
                  {options.pickup_points.map((point) => (
                    <option key={point.id} value={point.name}>
                      {point.name} — {point.address}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-bold">{t("delivery.preferredDay")}</span>
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-12 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[15px] outline-none focus:border-[color:var(--color-brand)]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-bold">{t("delivery.time")}</span>
                <select
                  value={window_}
                  onChange={(event) => setWindow(event.target.value)}
                  className="h-12 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[15px] outline-none focus:border-[color:var(--color-brand)]"
                >
                  {options.windows.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </label>
            </div>

            <TextField label={t("delivery.anythingElse")} value={notes} onChange={setNotes} multiline placeholder={t("delivery.anythingElsePlaceholder")} />

            {error ? <Notice tone="danger">{error}</Notice> : null}

            <div className="flex items-center justify-between gap-3 border-t border-[color:var(--color-line)] pt-3">
              <p className="text-[13px]">
                <span className="text-[color:var(--color-ink-muted)]">{t("delivery.deliveryFee")}</span>{" "}
                <span className="font-black">{fee > 0 ? formatMoney(fee) : "Free"}</span>
              </p>
              <Button type="submit" size="lg" loading={submitting}>
                {submitting ? t("delivery.sending") : t("delivery.confirm")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  multiline,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
  inputMode?: "tel" | "text";
}) {
  const className =
    "w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-[15px] outline-none transition-colors focus:border-[color:var(--color-brand)] focus:ring-2 focus:ring-[color:var(--color-brand-200)]";

  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          rows={3}
          placeholder={placeholder}
          className={`${className} resize-y py-2.5`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          placeholder={placeholder}
          inputMode={inputMode}
          className={`${className} h-12`}
        />
      )}
    </label>
  );
}
