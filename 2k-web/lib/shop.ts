import api from "./api";
import type {
  Address,
  AddressInput,
  Availability,
  DeliveryOptions,
  DeliveryRequest,
  SourcingRequest,
  VendorApplication,
  ChatMessage,
  ChatParticipant,
  ChatProductContext,
  ChatThread,
  VendorSummary,
  Category,
  HomeFeed,
  Order,
  ProductCard,
  ProductDetail,
  ProductListing,
} from "./types";

/**
 * Typed client for the public storefront API.
 *
 * Every network call the storefront makes goes through here, so request
 * shapes, query-string building and error handling live in one place rather
 * than being re-invented in each page component.
 */

export interface ProductQuery {
  category_id?: number;
  subcategory_id?: number;
  vendor_id?: number;
  q?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  on_sale?: boolean;
  rating?: number;
  /** The defining filter: is it here, or is it coming? */
  availability?: Availability;
  source_country?: string;
  /** Verified sellers only. */
  verified?: boolean;
  /** "I need it within N days" — matched against the promised upper bound. */
  max_days?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "rating" | "discount" | "relevance";
  page?: number;
  per_page?: number;
}

function toParams(query: ProductQuery): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    // Laravel's boolean validation accepts 1/0 but not "true"/"false" strings.
    params[key] = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
  }

  return params;
}

export const shop = {
  async home(): Promise<HomeFeed> {
    const { data } = await api.get<HomeFeed>("/shop/home");
    return data;
  },

  async vendors(): Promise<VendorSummary[]> {
    const { data } = await api.get<{ vendors: VendorSummary[] }>("/shop/vendors");
    return data.vendors;
  },

  async categories(): Promise<Category[]> {
    const { data } = await api.get<{ categories: Category[] }>("/shop/categories");
    return data.categories;
  },

  async category(id: number) {
    const { data } = await api.get(`/shop/categories/${id}`);
    return data as {
      category: { id: number; name: string; image: string | null };
      subcategories: { id: number; name: string; image: string | null; product_count: number }[];
      shelves: { id: number; title: string; products: ProductCard[] }[];
    };
  },

  async products(query: ProductQuery = {}): Promise<ProductListing> {
    const { data } = await api.get<ProductListing>("/shop/products", {
      params: toParams(query),
    });
    return data;
  },

  async product(id: number) {
    const { data } = await api.get(`/shop/products/${id}`);
    return data as {
      product: ProductDetail;
      related: ProductCard[];
      from_vendor: ProductCard[];
    };
  },

  /* ---- sourcing requests: "find this for me" ---- */

  /**
   * Open to signed-out visitors on purpose — someone who cannot find what they
   * need should not have to register before telling us what it is. Sent as
   * multipart because a photo is usually the clearest description there is.
   */
  async requestProduct(payload: {
    name: string;
    description?: string;
    brand?: string;
    /** ISO alpha-2. Where they would rather we bought it, if they mind. */
    preferred_country?: string;
    urgency?: "standard" | "soon" | "urgent";
    quantity: number;
    budget_max?: number;
    contact_name: string;
    contact_phone: string;
    contact_email?: string;
    delivery_city?: string;
    image?: File | null;
  }) {
    const form = new FormData();

    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null || value === "") continue;
      form.append(key, value instanceof File ? value : String(value));
    }

    const { data } = await api.post("/shop/requests", form, {
      // Let the browser set the boundary; a hand-written header breaks it.
      headers: { "Content-Type": undefined },
      transformRequest: [(body) => body],
    });

    return data as { message: string; request: SourcingRequest };
  },

  async myRequests(): Promise<SourcingRequest[]> {
    const { data } = await api.get<{ requests: SourcingRequest[] }>("/shop/requests");
    return data.requests;
  },

  async cancelRequest(reference: string) {
    await api.post(`/shop/requests/${reference}/cancel`);
  },

  /* ---- selling on 2KONECT ---- */

  async applyToSell(payload: {
    full_name: string;
    business_name: string;
    phone: string;
    email?: string;
    region?: string;
    city?: string;
    business_type?: string;
    category?: string;
    products?: string;
    website?: string;
    id_number?: string;
  }) {
    const { data } = await api.post("/shop/vendor-applications", payload);
    return data as { message: string; application: VendorApplication };
  },

  async myApplication(): Promise<VendorApplication | null> {
    const { data } = await api.get<{ application: VendorApplication | null }>(
      "/shop/vendor-applications/mine",
    );
    return data.application;
  },

  /* ---- 2KONECT Rides: the last mile ---- */

  async deliveryOptions(reference: string): Promise<DeliveryOptions> {
    const { data } = await api.get<DeliveryOptions>(`/shop/orders/${reference}/delivery-options`);
    return data;
  },

  async requestDelivery(payload: {
    order_reference: string;
    mode: "delivery" | "pickup";
    recipient_name: string;
    recipient_phone: string;
    address?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    pickup_point?: string;
    preferred_date?: string;
    preferred_window?: string;
    notes?: string;
  }) {
    const { data } = await api.post("/shop/deliveries", payload);
    return data as { message: string; request: DeliveryRequest };
  },

  async deliveries(): Promise<DeliveryRequest[]> {
    const { data } = await api.get<{ requests: DeliveryRequest[] }>("/shop/deliveries");
    return data.requests;
  },

  async cancelDelivery(reference: string) {
    await api.post(`/shop/deliveries/${reference}/cancel`);
  },

  async suggest(term: string) {
    const { data } = await api.get("/shop/products/suggest", { params: { q: term } });
    return data as {
      products: { id: number; name: string; price: number }[];
      categories: { id: number; name: string }[];
    };
  },

  /* ---- authenticated ---- */

  async wishlist() {
    const { data } = await api.get("/shop/wishlist");
    return data as { products: ProductCard[]; ids: number[] };
  },

  async addToWishlist(productId: number) {
    await api.post("/shop/wishlist", { product_id: productId });
  },

  async removeFromWishlist(productId: number) {
    await api.delete(`/shop/wishlist/${productId}`);
  },

  async syncWishlist(productIds: number[]) {
    const { data } = await api.post("/shop/wishlist/sync", { product_ids: productIds });
    return data as { products: ProductCard[]; ids: number[] };
  },

  async orders(): Promise<Order[]> {
    const { data } = await api.get<{ orders: Order[] }>("/shop/orders");
    return data.orders;
  },

  async order(reference: string): Promise<Order> {
    const { data } = await api.get<{ order: Order }>(`/shop/orders/${reference}`);
    return data.order;
  },

  async placeOrder(payload: {
    // `offer_id` carries the buying option the shopper chose — the imported
    // alternative rather than the product's own local offer.
    items: { product_id: number; quantity: number; offer_id?: number | null }[];
    delivery_address: string;
    customer_phone: string;
    payment_method: "cash_on_delivery" | "mobile_money";
    payment_provider?: string;
  }) {
    const { data } = await api.post("/shop/orders", payload);
    return data as { message: string; reference: string; order: Order };
  },

  async cancelOrder(reference: string) {
    await api.post(`/shop/orders/${reference}/cancel`);
  },

  /* ---------------- shopper ↔ seller messaging ---------------- */

  async chatThreads(): Promise<ChatThread[]> {
    const { data } = await api.get<{ threads: ChatThread[] }>("/shop/chat/threads");
    return data.threads;
  },

  async chatThread(userId: number) {
    const { data } = await api.get<{
      participant: ChatParticipant;
      product: ChatProductContext | null;
      messages: ChatMessage[];
    }>(`/shop/chat/${userId}`);
    return data;
  },

  async sendChat(payload: {
    vendor_id?: number;
    user_id?: number;
    product_id?: number;
    message: string;
  }): Promise<ChatMessage> {
    const { data } = await api.post<{ message: ChatMessage }>("/shop/chat", payload);
    return data.message;
  },

  /* ---------------- delivery address book ---------------- */

  async addresses(): Promise<Address[]> {
    const { data } = await api.get<{ addresses: Address[] }>("/shop/addresses");
    return data.addresses;
  },

  async createAddress(payload: AddressInput): Promise<Address[]> {
    const { data } = await api.post<{ addresses: Address[] }>("/shop/addresses", payload);
    return data.addresses;
  },

  async updateAddress(id: number, payload: AddressInput): Promise<Address[]> {
    const { data } = await api.put<{ addresses: Address[] }>(`/shop/addresses/${id}`, payload);
    return data.addresses;
  },

  async deleteAddress(id: number): Promise<Address[]> {
    const { data } = await api.delete<{ addresses: Address[] }>(`/shop/addresses/${id}`);
    return data.addresses;
  },

  async setDefaultAddress(id: number): Promise<Address[]> {
    const { data } = await api.post<{ addresses: Address[] }>(`/shop/addresses/${id}/default`);
    return data.addresses;
  },
};

export default shop;
