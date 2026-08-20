import api from "./api";
import type { ProductCard } from "./types";

/** An attribute an administrator has defined, with its allowed options. */
export interface SellerAttribute {
  id: number;
  name: string;
  type: "select" | "multiselect" | "text" | "number";
  unit: string | null;
  options: string[];
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
  }) {
    const form = new FormData();
    form.append("name", fields.name);
    form.append("category_id", String(fields.category_id));
    if (fields.subcategory_id) form.append("subcategory_id", String(fields.subcategory_id));
    if (fields.short_description) form.append("short_description", fields.short_description);
    if (fields.description) form.append("description", fields.description);
    form.append("new_price", String(fields.new_price));
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
    }>
  ) {
    const form = new FormData();

    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || key === "images") continue;
      if (key === "remove_images") {
        if (value) form.append("remove_images", "true");
        continue;
      }
      form.append(key, String(value));
    }

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
