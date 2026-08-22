"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiError } from "@/lib/api";
import shop from "@/lib/shop";
import vendorApi from "@/lib/vendor";
import type { Category, ProductDetail } from "@/lib/types";
import { Button } from "@/components/ui/Primitives";
import { useT } from "@/lib/i18n";
import { ProductImagePicker, type PickedImage } from "./ProductImagePicker";
import type { SellerAttribute } from "@/lib/vendor";
import { PriceTierEditor, validate as validateTiers, type TierDraft } from "./PriceTierEditor";
import { VariantEditor, findDuplicates, incomplete, type VariantDraft } from "./VariantEditor";

/**
 * Countries the marketplace sources from, mirroring App\Support\Sourcing.
 * Kept short on purpose: an accurate list of routes we actually run beats a
 * complete list of every country on earth.
 */
const COUNTRIES = [
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "AE", name: "UAE", flag: "🇦🇪" },
  { code: "TR", name: "Türkiye", flag: "🇹🇷" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
];

/**
 * Shared create/edit form for a vendor's product.
 *
 * On edit, newly chosen photos are *added* to the gallery. Existing photos are
 * only removed when the seller ticks the explicit "replace" option — losing a
 * product's photography by accident is not an acceptable outcome.
 */
export function ProductForm({ product }: { product?: ProductDetail }) {
  const t = useT();
  const router = useRouter();
  const editing = Boolean(product);

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const [form, setForm] = useState({
    name: product?.name ?? "",
    short_description: product?.short_description ?? "",
    category_id: product?.category?.id ?? 0,
    subcategory_id: product?.subcategory?.id ?? 0,
    description: product?.description ?? "",
    new_price: product?.price.current ?? 0,
    old_price: product?.price.was ?? 0,
    stock: product?.stock ?? 0,
    // Where this stock is. Defaults to local, which is what a seller holding
    // goods in Tanzania means and what every existing listing already is.
    availability: (product?.sourcing?.type ?? "local") as "local" | "import",
    source_country: product?.sourcing?.origin?.code ?? "TZ",
    shipping_method: product?.sourcing?.shipping_method?.code ?? "",
    lead_time_min_days: product?.sourcing?.lead_time.min ?? 1,
    lead_time_max_days: product?.sourcing?.lead_time.max ?? 3,
    fulfilment_location: product?.sourcing?.fulfilment_location ?? "",
  });

  const [images, setImages] = useState<PickedImage[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Admin-defined properties for the chosen category, and the seller's values.
  const [attributes, setAttributes] = useState<SellerAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<number, string>>({});

  // Both optional, and both seeded from the product so editing shows what is
  // already configured rather than an empty form that would wipe it on save.
  const [tiers, setTiers] = useState<TierDraft[]>(
    (product?.price_tiers ?? []).map((tier) => ({
      min_quantity: tier.min_quantity,
      max_quantity: tier.max_quantity ?? "",
      unit_price: tier.unit_price,
    })),
  );

  const [axes, setAxes] = useState<number[]>(
    (product?.options ?? []).map((axis) => axis.attribute_id),
  );

  const [variants, setVariants] = useState<VariantDraft[]>(
    (product?.variants ?? []).map((variant) => ({
      sku: variant.sku ?? "",
      // A variant that matches the product's price is inheriting it; showing
      // the figure would turn an inherited price into a pinned one on save.
      price: variant.price.current === (product?.price.current ?? -1) ? "" : variant.price.current,
      stock: variant.stock,
      options: Object.fromEntries(
        variant.options.map((option) => [option.attribute_id, option.attribute_value_id]),
      ),
    })),
  );

  useEffect(() => {
    shop.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // Re-fetch whenever the category changes: a fashion seller should not be
  // asked for RAM, and the option lists differ per category.
  useEffect(() => {
    if (!form.category_id) { setAttributes([]); return; }
    let cancelled = false;
    vendorApi
      .attributes(form.category_id)
      .then((list) => { if (!cancelled) setAttributes(list); })
      .catch(() => { if (!cancelled) setAttributes([]); });
    return () => { cancelled = true; };
  }, [form.category_id]);

  const subcategories =
    categories.find((category) => category.id === form.category_id)?.subcategories ?? [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!editing && images.length === 0) {
      setError(t("productForm.noPhotos"));
      return;
    }

    if (!form.category_id) {
      setError(t("productForm.selectCategory"));
      return;
    }

    // The server enforces both of these; catching them here means the seller
    // is told which row is wrong instead of being handed a validation error
    // after the upload.
    if (validateTiers(tiers, t).some(Boolean)) {
      setError("Fix the overlapping or incomplete bulk pricing rows first.");
      return;
    }

    const readyVariants = variants.filter((variant) => !incomplete(variant, axes));

    if (variants.length !== readyVariants.length) {
      setError("Every variant needs a value for each option.");
      return;
    }

    if (findDuplicates(variants, axes).some(Boolean)) {
      setError("Two variants describe the same combination.");
      return;
    }

    setSaving(true);

    try {
      if (editing && product) {
        await vendorApi.updateProduct(product.id, {
          name: form.name,
          category_id: form.category_id,
          subcategory_id: form.subcategory_id || undefined,
          description: form.description,
          new_price: form.new_price,
          old_price: form.old_price || undefined,
          stock: form.stock,
          short_description: form.short_description || undefined,
          availability: form.availability,
          source_country: form.source_country || undefined,
          shipping_method: form.availability === "import" ? form.shipping_method || undefined : undefined,
          lead_time_min_days: form.lead_time_min_days || undefined,
          lead_time_max_days: form.lead_time_max_days || undefined,
          fulfilment_location: form.fulfilment_location || undefined,
          images: images.length ? images.map((image) => image.file) : undefined,
          remove_images: replaceExisting,
          price_tiers: tierPayload(tiers),
          variants: variantPayload(readyVariants, axes),
        });
      } else {
        await vendorApi.createProduct({
          name: form.name,
          category_id: form.category_id,
          subcategory_id: form.subcategory_id || undefined,
          short_description: form.short_description || undefined,
          description: form.description,
          new_price: form.new_price,
          old_price: form.old_price || undefined,
          stock: form.stock,
          availability: form.availability,
          source_country: form.source_country || undefined,
          shipping_method: form.availability === "import" ? form.shipping_method || undefined : undefined,
          lead_time_min_days: form.lead_time_min_days || undefined,
          lead_time_max_days: form.lead_time_max_days || undefined,
          fulfilment_location: form.fulfilment_location || undefined,
          images: images.map((image) => image.file),
          attributes: attributeValues,
          price_tiers: tierPayload(tiers),
          variants: variantPayload(readyVariants, axes),
        });
      }

      router.push("/vendor/products");
    } catch (err) {
      setError(apiError(err, t("common.somethingWrong")));
      setSaving(false);
    }
  }

  /** Drops half-typed rows; the rest go as the API expects them. */
  function tierPayload(rows: TierDraft[]) {
    return rows
      .filter((tier) => tier.min_quantity !== "" && tier.unit_price !== "")
      .map((tier) => ({
        min_quantity: Number(tier.min_quantity),
        max_quantity: tier.max_quantity === "" ? null : Number(tier.max_quantity),
        unit_price: Number(tier.unit_price),
      }));
  }

  function variantPayload(rows: VariantDraft[], on: number[]) {
    return rows.map((variant) => ({
      sku: variant.sku || null,
      // Blank means "inherit the product price", which the server stores as
      // null rather than as a copy of today's figure.
      price: variant.price === "" ? null : Number(variant.price),
      stock: Number(variant.stock || 0),
      is_active: true,
      options: on.map((attributeId) => ({
        attribute_id: attributeId,
        attribute_value_id: variant.options[attributeId],
      })),
    }));
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
          <h2 className="mb-3 text-[15px] font-extrabold">{t("productForm.basics")}</h2>

          <div className="space-y-3">
            <Field label={t("productForm.name")} required value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="e.g. Samsung Galaxy A55 128GB" maxLength={100} />

            <div>
              <Field
                label={t("productForm.shortDescription")}
                value={form.short_description}
                onChange={(event) => update("short_description", event.target.value)}
                maxLength={300}
              />
              <p className="mt-1 text-[11px] text-[color:var(--color-ink-faint)]">
                {t("productForm.shortHint")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label={t("productForm.category")}
                required
                value={form.category_id}
                onChange={(event) => {
                  update("category_id", Number(event.target.value));
                  // The old subcategory belongs to the previous category, so
                  // clear it rather than submit a mismatched pair.
                  update("subcategory_id", 0);
                }}
              >
                <option value={0}>{t("seller.chooseCategory")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name.trim()}</option>
                ))}
              </SelectField>

              <SelectField
                label={t("productForm.subcategory")}
                value={form.subcategory_id}
                disabled={subcategories.length === 0}
                onChange={(event) => update("subcategory_id", Number(event.target.value))}
              >
                <option value={0}>
                  {subcategories.length === 0 ? "No subcategories" : "Optional"}
                </option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </SelectField>
            </div>

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
                Description
              </span>
              <textarea
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                rows={5}
                placeholder={t("seller.specPlaceholder")}
                className="w-full resize-y rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-brand)]"
              />
            </label>
          </div>
        </section>

        {/* Optional, and inert unless the seller uses them. */}
        <PriceTierEditor tiers={tiers} onChange={setTiers} />

        <VariantEditor
          attributes={attributes}
          axes={axes}
          onAxes={setAxes}
          variants={variants}
          onChange={setVariants}
          productPrice={form.new_price}
        />

        {/* Where the stock is. On 2KONECT this decides how the listing is
            filed, priced against, and what arrival date a buyer is promised —
            so it is a required decision, not an advanced setting. */}
        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
          <h2 className="text-[15px] font-extrabold">Availability &amp; delivery</h2>
          <p className="mt-0.5 text-[12px] text-[color:var(--color-ink-muted)]">
            Is this in Tanzania now, or do you bring it in when someone orders?
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {([
              {
                value: "local" as const,
                title: "🇹🇿 In Tanzania",
                note: "You hold the stock and ship it locally.",
              },
              {
                value: "import" as const,
                title: "🌍 From abroad",
                note: "Sourced on order and imported for the buyer.",
              },
            ]).map((option) => {
              const active = form.availability === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    update("availability", option.value);
                    // Move the promise with the choice, so a listing never
                    // keeps a one-day estimate after becoming an import.
                    if (option.value === "local") {
                      update("lead_time_min_days", 1);
                      update("lead_time_max_days", 3);
                      update("source_country", "TZ");
                      update("shipping_method", "");
                    } else {
                      update("lead_time_min_days", 7);
                      update("lead_time_max_days", 14);
                      if (form.source_country === "TZ") update("source_country", "CN");
                      update("shipping_method", "air");
                    }
                  }}
                  aria-pressed={active}
                  className={`rounded-[var(--radius-md)] border-2 p-3 text-left transition-colors ${
                    active
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-50)]"
                      : "border-[color:var(--color-line)] hover:border-[color:var(--color-line-strong)]"
                  }`}
                >
                  <span className="block text-[13px] font-extrabold">{option.title}</span>
                  <span className="mt-0.5 block text-[12px] text-[color:var(--color-ink-muted)]">
                    {option.note}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <SelectField
              label={t("seller.shipsFrom")}
              value={form.source_country}
              onChange={(event) => update("source_country", event.target.value)}
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </SelectField>

            {form.availability === "import" ? (
              <SelectField
                label={t("seller.howTravel")}
                value={form.shipping_method}
                onChange={(event) => update("shipping_method", event.target.value)}
              >
                <option value="">Not sure yet</option>
                <option value="air">Air freight (fastest)</option>
                <option value="sea">Sea freight (cheapest)</option>
                <option value="road">Road freight</option>
              </SelectField>
            ) : (
              <Field
                label="Ships out of"
                value={form.fulfilment_location}
                onChange={(event) => update("fulfilment_location", event.target.value)}
                placeholder="Your warehouse or shop, e.g. Dar es Salaam"
              />
            )}

            <Field
              label="Delivery from (days)"
              type="number"
              min={1}
              value={form.lead_time_min_days}
              onChange={(event) => update("lead_time_min_days", Number(event.target.value))}
            />
            <Field
              label="Delivery to (days)"
              type="number"
              min={1}
              value={form.lead_time_max_days}
              onChange={(event) => update("lead_time_max_days", Number(event.target.value))}
            />
          </div>

          <p className="mt-2 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-alt)] px-3 py-2 text-[12px] text-[color:var(--color-ink-muted)]">
            Buyers see this as{" "}
            <span className="font-bold text-[color:var(--color-ink)]">
              {form.availability === "local" ? "Available in Tanzania" : "Order from abroad"} ·{" "}
              {form.lead_time_min_days === form.lead_time_max_days
                ? `${form.lead_time_max_days} days`
                : `${form.lead_time_min_days}–${form.lead_time_max_days} days`}
            </span>
            . Promise a window you can keep.
          </p>
        </section>

        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
          <h2 className="mb-3 text-[15px] font-extrabold">{t("productForm.media")}</h2>

          {editing && product && product.images.length > 0 ? (
            <div className="mb-3">
              <p className="mb-2 text-[12px] text-[color:var(--color-ink-muted)]">
                Current photos ({product.images.length})
              </p>
              <div className="rail gap-2">
                {product.images.map((image) => (
                  <span key={image} className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-white ring-1 ring-[color:var(--color-line)]">
                    <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-1" />
                  </span>
                ))}
              </div>

              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] p-2.5 text-[12px]">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[color:var(--color-sale)]"
                />
                <span>
                  <span className="block font-semibold">Replace all current photos</span>
                  <span className="text-[color:var(--color-ink-muted)]">
                    Leave unticked and new photos are added alongside the existing ones.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          <ProductImagePicker images={images} onChange={setImages} />

        </section>

        {/* Structured properties, kept out of the description so the
            catalogue can be filtered on them. Only rendered once a category
            is chosen, because the list depends on it. */}
        {attributes.length > 0 ? (
          <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
            <h2 className="text-[15px] font-extrabold">{t("productForm.attributes")}</h2>
            <p className="mb-3 text-[11px] text-[color:var(--color-ink-muted)]">
              {t("productForm.attributesHint")}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {attributes.map((attribute) => (
                <label key={attribute.id} className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
                    {attribute.name}
                    {attribute.unit ? ` (${attribute.unit})` : ""}
                  </span>

                  {attribute.options.length > 0 ? (
                    <select
                      value={attributeValues[attribute.id] ?? ""}
                      onChange={(event) =>
                        setAttributeValues((current) => ({ ...current, [attribute.id]: event.target.value }))
                      }
                      className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                    >
                      <option value="">—</option>
                      {attribute.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={attribute.type === "number" ? "number" : "text"}
                      value={attributeValues[attribute.id] ?? ""}
                      onChange={(event) =>
                        setAttributeValues((current) => ({ ...current, [attribute.id]: event.target.value }))
                      }
                      maxLength={255}
                      className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
          <h2 className="mb-3 text-[15px] font-extrabold">{t("productForm.pricing")}</h2>

          <div className="space-y-3">
            <Field label={t("productForm.price")} required type="number" min={0} step={1}
              value={form.new_price || ""}
              onChange={(event) => update("new_price", Number(event.target.value))} />

            <Field label={t("productForm.wasPrice")} type="number" min={0} step={1}
              value={form.old_price || ""}
              onChange={(event) => update("old_price", Number(event.target.value))} />

            <Field label={t("productForm.stock")} required type="number" min={0}
              value={form.stock}
              onChange={(event) => update("stock", Number(event.target.value))} />
          </div>

          {form.old_price > 0 && form.new_price > 0 && form.old_price > form.new_price ? (
            <p className="mt-3 rounded-[var(--radius-sm)] bg-[color:var(--color-success-soft)] px-3 py-2 text-[12px] font-semibold text-[color:var(--color-success)]">
              Shoppers see {Math.round(((form.old_price - form.new_price) / form.old_price) * 100)}% off
            </p>
          ) : null}
        </section>

        <section className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] p-4">
          {error ? (
            <p role="alert" className="mb-3 rounded-[var(--radius-sm)] bg-[color:var(--color-danger-soft)] px-3 py-2 text-[13px] font-semibold text-[color:var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Publish product"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => router.push("/vendor/products")}
          >
            Cancel
          </Button>
        </section>
      </aside>
    </form>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
        {label}
      </span>
      <input
        {...props}
        className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-sm outline-none focus:border-[color:var(--color-brand)]"
      />
    </label>
  );
}

function SelectField({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-[color:var(--color-ink-muted)]">
        {label}
      </span>
      <select
        {...props}
        className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-2 text-sm outline-none focus:border-[color:var(--color-brand)] disabled:opacity-50"
      >
        {children}
      </select>
    </label>
  );
}

export default ProductForm;
