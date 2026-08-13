import api from "./api";
import type {
  Address,
  AddressInput,
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
    items: { product_id: number; quantity: number }[];
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
