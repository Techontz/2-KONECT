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

/**
 * Shared create/edit form for a vendor's product.
 *
 * On edit, newly chosen photos are *added* to the gallery. Existing photos are
 * only removed when the seller ticks the explicit "replace" option — losing a
 * product's photography by accident is not an acceptable outcome.
 */
export function ProductForm({ product }: { product?: ProductDetail }) {
  const router = useRouter();
  const editing = Boolean(product);

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useT();

  const [form, setForm] = useState({
    name: product?.name ?? "",
    short_description: product?.short_description ?? "",
    category_id: product?.category?.id ?? 0,
    subcategory_id: product?.subcategory?.id ?? 0,
    description: product?.description ?? "",
    new_price: product?.price.current ?? 0,
    old_price: product?.price.was ?? 0,
    stock: product?.stock ?? 0,
  });

  const [images, setImages] = useState<PickedImage[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Admin-defined properties for the chosen category, and the seller's values.
  const [attributes, setAttributes] = useState<SellerAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<number, string>>({});

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
          images: images.length ? images.map((image) => image.file) : undefined,
          remove_images: replaceExisting,
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
          images: images.map((image) => image.file),
          attributes: attributeValues,
        });
      }

      router.push("/vendor/products");
    } catch (err) {
      setError(apiError(err, t("common.somethingWrong")));
      setSaving(false);
    }
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
                <option value={0}>Choose a category</option>
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
                placeholder="Size, colour, condition, what's included…"
                className="w-full resize-y rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-action)]"
              />
            </label>
          </div>
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
                      className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-3 text-sm outline-none focus:border-[color:var(--color-action)]"
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
                      className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-sm outline-none focus:border-[color:var(--color-action)]"
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
            <p role="alert" className="mb-3 rounded-[var(--radius-sm)] bg-red-50 px-3 py-2 text-[13px] text-[color:var(--color-sale)]">
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
        className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] px-3 text-sm outline-none focus:border-[color:var(--color-action)]"
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
        className="h-11 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-line-strong)] bg-white px-2 text-sm outline-none focus:border-[color:var(--color-action)] disabled:opacity-50"
      >
        {children}
      </select>
    </label>
  );
}

export default ProductForm;
