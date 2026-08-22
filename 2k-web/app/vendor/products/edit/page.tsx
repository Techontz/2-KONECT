"use client";

import { useT } from "@/lib/i18n";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import shop from "@/lib/shop";
import type { ProductDetail } from "@/lib/types";
import { ProductForm } from "@/components/vendor/ProductForm";
import { EmptyState, Skeleton } from "@/components/ui/Primitives";

export default function EditProductPage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-64 w-full" /></div>}>
      <EditContent />
    </Suspense>
  );
}

function EditContent() {
  const t = useT();
  const params = useSearchParams();
  const id = Number(params.get("id"));

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) { setMissing(true); return; }
    shop.product(id).then((data) => setProduct(data.product)).catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return <EmptyState title={t("productForm.notFound")} message={t("productForm.notFoundHint")} />;
  }

  if (!product) {
    return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <header>
        <h1 className="clamp-1 text-[24px] font-black tracking-tight">{product.name}</h1>
        <p className="text-[13px] text-[color:var(--color-ink-muted)]">{t("productForm.editingListing")}</p>
      </header>

      <ProductForm product={product} />
    </div>
  );
}
