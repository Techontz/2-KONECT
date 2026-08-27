"use client";

import { useState } from "react";
import type { Address, AddressInput } from "@/lib/types";
import { Button } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";

/**
 * Tanzania's regions, for the delivery-region picker.
 *
 * A fixed list rather than free text: the region is what determines the
 * courier route, so a typo there is the difference between a parcel arriving
 * and not.
 */
export const TZ_REGIONS = [
  "Arusha", "Dar es Salaam", "Dodoma", "Geita", "Iringa", "Kagera",
  "Katavi", "Kigoma", "Kilimanjaro", "Lindi", "Manyara", "Mara",
  "Mbeya", "Mjini Magharibi", "Morogoro", "Mtwara", "Mwanza", "Njombe",
  "Kaskazini Pemba", "Kusini Pemba", "Pwani", "Rukwa", "Ruvuma",
  "Shinyanga", "Simiyu", "Singida", "Songwe", "Tabora", "Tanga",
  "Kaskazini Unguja", "Kusini Unguja",
] as const;

const EMPTY: AddressInput = {
  full_name: "",
  phone: "",
  region: "",
  city: "",
  district: "",
  street: "",
  details: "",
  latitude: null,
  longitude: null,
  is_default: false,
};

/**
 * Add / edit form for a delivery address.
 *
 * Validation mirrors the backend rules so the customer is told what is wrong
 * before a round trip, but the backend remains the authority — this is a
 * courtesy, not the gate.
 */
export function AddressForm({
  initial,
  forceDefault = false,
  onSubmit,
  onCancel,
}: {
  initial: Address | null;
  forceDefault?: boolean;
  onSubmit: (values: AddressInput) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [values, setValues] = useState<AddressInput>(() =>
    initial
      ? {
          full_name: initial.full_name,
          phone: initial.phone,
          region: initial.region,
          city: initial.city,
          district: initial.district ?? "",
          street: initial.street ?? "",
          details: initial.details ?? "",
          // A saved map pin is carried through an edit rather than discarded.
          latitude: initial.latitude,
          longitude: initial.longitude,
          is_default: initial.is_default,
        }
      : { ...EMPTY, is_default: forceDefault },
  );

  const [errors, setErrors] = useState<Partial<Record<keyof AddressInput, string>>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof AddressInput, string>> = {};

    if (!values.full_name.trim()) next.full_name = t("address.errName");
    if (!values.phone.trim()) next.phone = t("address.errPhone");
    if (!values.region.trim()) next.region = t("address.errRegion");
    if (!values.city.trim()) next.city = t("address.errCity");

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /**
   * Save, without ever telling an enclosing form to submit.
   *
   * This used to be a <form onSubmit>, which was fine on the account page and
   * quietly broken at checkout: the checkout page wraps everything in its own
   * <form onSubmit={placeOrder}> and renders this inside it. Nesting a form in
   * a form is invalid HTML, but the damage was not the validity — `submit`
   * bubbles, and React replays events through its tree, so every click on
   * "Save address" also ran placeOrder. Off a gateway channel that placed the
   * order outright, emptied the cart and navigated away; the address the
   * shopper had just typed went with it. It fired even when validation here
   * had failed and nothing was saved at all.
   *
   * So this is no longer a form. Nothing bubbles, because no submit event is
   * ever raised. Enter is handled below so the keyboard still works.
   */
  async function handleSubmit(event?: { preventDefault(): void; stopPropagation(): void }) {
    event?.preventDefault();
    event?.stopPropagation();

    if (saving || !validate()) return;

    setSaving(true);
    try {
      await onSubmit({
        ...values,
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        region: values.region.trim(),
        city: values.city.trim(),
        district: values.district?.trim() || null,
        street: values.street?.trim() || null,
        details: values.details?.trim() || null,
        is_default: forceDefault ? true : values.is_default,
      });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Enter saves the address, and goes no further.
   *
   * Without this, losing the <form> would trade one bug for a quieter one: a
   * text input inside an enclosing form submits *that* form on Enter, so the
   * shopper pressing return after typing their street would place the order.
   * Textareas keep Enter as a newline, which is what it means there.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") return;
    if ((event.target as HTMLElement).tagName === "TEXTAREA") return;

    event.preventDefault();
    event.stopPropagation();
    void handleSubmit();
  }

  return (
    <div
      role="group"
      aria-label={initial ? t("address.formEdit") : t("address.formAdd")}
      onKeyDown={handleKeyDown}
      className="mb-4 rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4 ring-1 ring-[color:var(--color-line)]"
    >
      <h2 className="mb-3 text-[16px] font-black">
        {initial ? t("address.formEdit") : t("address.formAdd")}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t("address.fullName")}
          value={values.full_name}
          error={errors.full_name}
          onChange={(v) => set("full_name", v)}
          autoComplete="name"
        />
        <Field
          label={t("address.phone")}
          value={values.phone}
          error={errors.phone}
          onChange={(v) => set("phone", v)}
          type="tel"
          placeholder="07XX XXX XXX"
          autoComplete="tel"
        />

        <label className="block">
          <span className="mb-1 block text-[12px] font-bold text-[color:var(--color-ink-muted)]">
            {t("address.region")}
          </span>
          <select
            value={values.region}
            onChange={(event) => set("region", event.target.value)}
            className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
          >
            <option value="">{t("address.selectRegion")}</option>
            {TZ_REGIONS.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
          {errors.region ? <FieldError message={errors.region} /> : null}
        </label>

        <Field
          label={t("address.city")}
          value={values.city}
          error={errors.city}
          onChange={(v) => set("city", v)}
          placeholder={t("address.cityPlaceholder")}
        />
        <Field
          label={t("address.district")}
          hint={t("common.optional")}
          value={values.district ?? ""}
          onChange={(v) => set("district", v)}
          placeholder={t("address.districtPlaceholder")}
        />
        <Field
          label={t("address.street")}
          hint={t("common.optional")}
          value={values.street ?? ""}
          onChange={(v) => set("street", v)}
          placeholder={t("address.streetPlaceholder")}
        />
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[12px] font-bold text-[color:var(--color-ink-muted)]">
          {t("address.notes")} <span className="font-normal">({t("common.optional")})</span>
        </span>
        <textarea
          value={values.details ?? ""}
          onChange={(event) => set("details", event.target.value)}
          rows={2}
          maxLength={500}
          placeholder={t("address.notesPlaceholder")}
          className="w-full resize-y rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-brand)]"
        />
      </label>

      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={forceDefault ? true : values.is_default}
          disabled={forceDefault}
          onChange={(event) => set("is_default", event.target.checked)}
          className="h-4 w-4 accent-[color:var(--color-brand)]"
        />
        <span className="text-[13px]">
          {forceDefault
            ? t("address.willBeDefault")
            : t("address.makeDefault")}
        </span>
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        {/* Explicitly type="button". A submit button here would look for a
            form to submit and find the checkout's. */}
        <Button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? t("common.saving") : initial ? t("address.saveChanges") : t("address.saveAddress")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  error,
  onChange,
  ...input
}: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold text-[color:var(--color-ink-muted)]">
        {label} {hint ? <span className="font-normal">({hint})</span> : null}
      </span>
      <input
        {...input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-11 w-full rounded-[var(--radius-sm)] border bg-[color:var(--color-surface)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)] ${
          error ? "border-[color:var(--color-sale)]" : "border-[color:var(--color-line-strong)]"
        }`}
      />
      {error ? <FieldError message={error} /> : null}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <span className="mt-1 block text-[11px] font-semibold text-[color:var(--color-sale)]">
      {message}
    </span>
  );
}
