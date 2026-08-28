import api from "./api";
import type { ProductCard } from "./types";

/** An attribute an administrator has defined, with its allowed options. */
export interface SellerAttribute {
  id: number;
  name: string;
  type: "select" | "multiselect" | "text" | "number";
  unit: string | null;
  /** Curated values as plain text, for the specification fields. */
  options: string[];
  /** The same values with ids — what a variant names. */
  values?: { id: number; value: string }[];
}


/**
 * Flattens the optional pricing and variant structures into the multipart
 * body, in the bracket notation Laravel's validator reads back as arrays.
 *
 * Both are skipped entirely when absent, which is what tells the server to
 * leave whatever the product already has alone — an omitted key must never be
 * read as "delete these".
 */
function appendPricing(
  form: FormData,
  fields: {
    price_tiers?: { min_quantity: number; max_quantity: number | null; unit_price: number }[];
    variants?: {
      sku: string | null;
      price: number | null;
      stock: number;
      is_active: boolean;
      options: { attribute_id: number; attribute_value_id: number }[];
    }[];
  },
) {
  if (fields.price_tiers) {
    if (fields.price_tiers.length === 0) {
      // An explicit empty array is how a seller clears their tiers. A bare
      // key with no rows does not survive multipart, so it is sent as a flag
      // the server reads as "present, and empty".
      form.append("price_tiers", "");
    }

    fields.price_tiers.forEach((tier, index) => {
      form.append(`price_tiers[${index}][min_quantity]`, String(tier.min_quantity));
      if (tier.max_quantity !== null) {
        form.append(`price_tiers[${index}][max_quantity]`, String(tier.max_quantity));
      }
      form.append(`price_tiers[${index}][unit_price]`, String(tier.unit_price));
    });
  }

  if (fields.variants) {
    if (fields.variants.length === 0) form.append("variants", "");

    fields.variants.forEach((variant, index) => {
      if (variant.sku) form.append(`variants[${index}][sku]`, variant.sku);
      if (variant.price !== null) form.append(`variants[${index}][price]`, String(variant.price));
      form.append(`variants[${index}][stock]`, String(variant.stock));
      form.append(`variants[${index}][is_active]`, variant.is_active ? "1" : "0");

      variant.options.forEach((option, position) => {
        form.append(`variants[${index}][options][${position}][attribute_id]`, String(option.attribute_id));
        form.append(`variants[${index}][options][${position}][attribute_value_id]`, String(option.attribute_value_id));
      });
    });
  }
}

/** Typed client for the vendor portal API (`/api/shop/vendor/*`). */

export interface VendorProfile {
  id: number;
  name: string;
  logo: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  is_approved: boolean;
  since: string | null;
}

export interface VendorStats {
  products: number;
  in_stock: number;
  out_of_stock: number;
  low_stock: number;
  orders: number;
  orders_pending: number;
  units_sold: number;
  earnings: number;
  paid_out: number;
  currency: string;
}

export interface VendorOrder {
  id: number;
  reference: string;
  status: string;
  status_label: string;
  /** Whether this line ships locally or has to be brought in. */
  fulfilment_type: "local" | "import";
  /**
   * What the seller must not have to ask about.
   *
   * Both come from the server so the console, the admin panel and the buyer's
   * own order page use one vocabulary. An unpaid import never reaches this
   * list at all — the query excludes it — so `payment` here is a statement
   * about work that is genuinely the seller's.
   */
  payment?: { code: string; label: string; tone: string };
  origin?: { code: "local" | "import"; label: string; flag: string };
  /** The next stop on this line's route, or null when it is closed. */
  next_status: { value: string; label: string } | null;
  quantity: number;
  price: number;
  total: number;
  placed_at: string | null;
  customer: { name: string; phone: string | null };
  address: string | null;
  product: { id: number; name: string; image: string | null } | null;
}

/** The seller's earnings, and the payouts they have asked for. */
export interface VendorWallet {
  balance: number;
  currency: string;
  payouts: {
    id: number;
    amount: number;
    method: string | null;
    account_number: string | null;
    status: string;
    requested_at: string | null;
  }[];
}

export interface VendorDashboard {
  vendor: VendorProfile;
  stats: VendorStats;
  sales_trend: { date: string; total: number }[];
  top_products: { id: number; name: string; units: number; revenue: number }[];
  low_stock_products: ProductCard[];
}

export const vendorApi = {
  async dashboard(): Promise<VendorDashboard> {
    const { data } = await api.get<VendorDashboard>("/shop/vendor/dashboard");
    return data;
  },

  async products(params: { q?: string; stock?: "low" | "out"; page?: number } = {}) {
    const { data } = await api.get("/shop/vendor/products", { params });
    return data as {
      products: ProductCard[];
      meta: { total: number; current_page: number; last_page: number; has_more: boolean };
    };
  },

  async orders(params: { status?: string; page?: number } = {}) {
    const { data } = await api.get("/shop/vendor/orders", { params });
    return data as {
      orders: VendorOrder[];
      meta: { total: number; current_page: number; last_page: number; has_more: boolean };
    };
  },

  async wallet(): Promise<VendorWallet> {
    const { data } = await api.get<VendorWallet>("/vendor/wallet");
    return data;
  },

  /**
   * Ask for a payout. The server debits the balance and records the request in
   * one transaction, so a payout can always be traced back.
   */
  async requestPayout(payload: { amount: number; method: string; account_number: string }) {
    const { data } = await api.post("/withdraw", payload);
    return data as { message: string };
  },

  async setOrderStatus(orderId: number, status: string) {
    const { data } = await api.post(`/shop/vendor/orders/${orderId}/status`, { status });
    return data as { message: string; status: string };
  },

  /**
   * Create a product. Sent as multipart because the API takes image files
   * directly; `images[]` is required by the backend for a new listing.
   */
  /** Attributes an administrator has defined for this category. */
  async attributes(categoryId?: number) {
    const { data } = await api.get<{ attributes: SellerAttribute[] }>("/shop/seller/attributes", {
      params: categoryId ? { category_id: categoryId } : {},
    });
    return data.attributes;
  },

  async createProduct(fields: {
    name: string;
    short_description?: string;
    category_id: number;
    subcategory_id?: number;
    description?: string;
    new_price: number;
    /** The currency the seller typed those figures in. Never converted. */
    base_currency?: "TZS" | "USD";
    old_price?: number;
    stock: number;
    images: File[];
    /** Structured properties keyed by attribute id. */
    attributes?: Record<number, string>;
    /** Where the stock is, and how long it takes to reach the buyer. */
    availability?: "local" | "import";
    source_country?: string;
    shipping_method?: string;
    lead_time_min_days?: number;
    lead_time_max_days?: number;
    fulfilment_location?: string;
    /** Optional quantity breaks. Omit to leave existing ones untouched. */
    price_tiers?: { min_quantity: number; max_quantity: number | null; unit_price: number }[];
    /** Optional selectable combinations. Omit to leave existing ones untouched. */
    variants?: {
      sku: string | null;
      price: number | null;
      stock: number;
      is_active: boolean;
      options: { attribute_id: number; attribute_value_id: number }[];
    }[];
  }) {
    const form = new FormData();
    form.append("name", fields.name);
    form.append("category_id", String(fields.category_id));
    if (fields.subcategory_id) form.append("subcategory_id", String(fields.subcategory_id));
    if (fields.short_description) form.append("short_description", fields.short_description);
    if (fields.description) form.append("description", fields.description);
    form.append("new_price", String(fields.new_price));
    if (fields.base_currency) form.append("base_currency", fields.base_currency);
    if (fields.old_price) form.append("old_price", String(fields.old_price));
    form.append("stock", String(fields.stock));

    for (const key of [
      "availability", "source_country", "shipping_method",
      "lead_time_min_days", "lead_time_max_days", "fulfilment_location",
    ] as const) {
      const value = fields[key];
      if (value !== undefined && value !== "") form.append(key, String(value));
    }

    // Images are appended in the seller's chosen order; the first becomes the
    // one shoppers see on cards.
    fields.images.forEach((file) => form.append("images[]", file));

    Object.entries(fields.attributes ?? {}).forEach(([id, value]) => {
      if (value) form.append(`attributes[${id}]`, value);
    });

    appendPricing(form, fields);

    const { data } = await api.post("/products", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /**
   * Update a product. New images are *added* to the gallery — existing photos
   * are only removed when `remove_images` is explicitly set, which is what the
   * backend now enforces too.
   */
  async updateProduct(
    id: number,
    fields: Partial<{
      name: string;
      category_id: number;
      subcategory_id: number;
      description: string;
      short_description: string;
      new_price: number;
      base_currency?: "TZS" | "USD";
      old_price: number;
      stock: number;
      images: File[];
      remove_images: boolean;
      availability: "local" | "import";
      source_country: string;
      shipping_method: string;
      lead_time_min_days: number;
      lead_time_max_days: number;
      fulfilment_location: string;
      price_tiers: { min_quantity: number; max_quantity: number | null; unit_price: number }[];
      variants: {
        sku: string | null;
        price: number | null;
        stock: number;
        is_active: boolean;
        options: { attribute_id: number; attribute_value_id: number }[];
      }[];
    }>
  ) {
    const form = new FormData();

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || key === "images") continue;
      // Both are arrays of objects and are appended field by field below;
      // String()-ing them here would post "[object Object]".
      if (key === "price_tiers" || key === "variants") continue;
      if (key === "remove_images") {
        if (value) form.append("remove_images", "true");
        continue;
      }
      form.append(key, String(value));
    }

    appendPricing(form, fields);

    (fields.images ?? []).forEach((file) => form.append("images[]", file));

    const { data } = await api.post(`/products/${id}`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  async deleteProduct(id: number) {
    await api.delete(`/products/${id}`);
  },
};

export default vendorApi;
