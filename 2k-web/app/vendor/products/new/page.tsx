"use client";

import { useT } from "@/lib/i18n";
import { ProductForm } from "@/components/vendor/ProductForm";

export default function NewProductPage() {
  const t = useT();
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <header>
        <h1 className="text-[24px] font-black tracking-tight">{t("productForm.addProduct")}</h1>
        <p className="text-[13px] text-[color:var(--color-ink-muted)]">
          It appears on the marketplace as soon as it is saved.
        </p>
      </header>

      <ProductForm />
    </div>
  );
}
