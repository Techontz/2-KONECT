/** Shapes returned by the Laravel storefront API (`/api/shop/*`). */

export interface Price {
  currency: string;
  current: number;
  was: number | null;
  discount_percent: number | null;
}

export interface Rating {
  average: number;
  count: number;
}

export interface Ref {
  id: number;
  name: string;
}

/* ==========================================================================
   Sourcing — where a product is, and when it lands
   --------------------------------------------------------------------------
   The distinction the whole storefront is organised around. Composed by the
   backend (App\Support\Sourcing) so every surface says the same thing.
   ========================================================================== */

export type Availability = "local" | "import";

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export interface LeadTime {
  min: number;
  max: number;
  /** Pre-composed, e.g. "1–3 days". */
  label: string;
}

export interface Sourcing {
  type: Availability;
  is_local: boolean;
  /** Short form for a card: "In Tanzania" / "Order from abroad". */
  label: string;
  /** Long form for a product page: "Available in Tanzania" / "Sourced from China". */
  headline: string;
  summary: string;
  origin: Country | null;
  destination: Country | null;
  lead_time: LeadTime;
  shipping_method: { code: string; label: string } | null;
  fulfilment_location: string | null;
}

/** One way to buy a product: its own row, or an imported alternative. */
export interface BuyingOption {
  /** Null for the product's own primary offer. */
  id: number | null;
  price: Price;
  stock: number;
  in_stock: boolean;
  seller: string;
  sourcing: Sourcing;
}

export interface ProductCard {
  id: number;
  name: string;
  image: string | null;
  images: string[];
  price: Price;
  rating: Rating;
  stock: number;
  in_stock: boolean;
  category?: Ref;
  subcategory?: Ref;
  vendor?: Ref & { is_verified?: boolean };
  sourcing: Sourcing;
  badges: {
    low_stock: boolean;
    out_of_stock: boolean;
    discounted: boolean;
  };
}

export interface Specification {
  label: string;
  value: string;
}

export interface Review {
  id: number;
  author: string;
  rating: number;
  comment: string | null;
  date: string | null;
}

/** Seller block on the product page, with contact details already normalised. */
export interface ProductVendor {
  id: number;
  name: string;
  logo: string | null;
  /** E.164, or null when the stored number is not dialable. */
  phone: string | null;
  phone_display: string | null;
  /** Ready-made wa.me link, or null when the number cannot take WhatsApp. */
  whatsapp: string | null;
  location: string | null;
  website: string | null;
  about: string | null;
  is_approved: boolean;
  /** Granted only by an administrator; drives the verified checkmark. */
  is_verified: boolean;
  member_since: string | null;
  /** The seller's account, used to open a chat thread. */
  user_id: number | null;
}

export interface ChatProductContext {
  id: number;
  name: string;
  image: string | null;
}

export interface ChatMessage {
  id: number;
  body: string;
  mine: boolean;
  read: boolean;
  sent_at: string | null;
  product: ChatProductContext | null;
}

export interface ChatParticipant {
  user_id: number;
  name: string;
  is_vendor: boolean;
  vendor_id: number | null;
  avatar: string | null;
}

export interface ChatThread extends ChatParticipant {
  last_message: string;
  last_at: string | null;
  unread: number;
  product: ChatProductContext | null;
}

export interface ProductDetail {
  id: number;
  name: string;
  /** One-line summary, separate from the long-form description. */
  short_description: string | null;
  description: string | null;
  image: string | null;
  images: string[];
  price: Price;
  stock: number;
  in_stock: boolean;
  category: Ref | null;
  subcategory: Ref | null;
  vendor: ProductVendor | null;
  sourcing: Sourcing;
  /** Primary offer first; more than one turns the page into a comparison. */
  buying_options: BuyingOption[];
  specifications: Specification[];
  rating: Rating & {
    distribution: { star: number; count: number; percent: number }[];
  };
  reviews: Review[];
}

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  image: string | null;
  product_count: number;
  subcategories: {
    id: number;
    name: string;
    icon: string | null;
    image: string | null;
  }[];
}

export interface Banner {
  id: number;
  title: string | null;
  alt: string | null;
  link: string | null;
  image: string | null;
}

export interface Shelf {
  id: number;
  title: string;
  products: ProductCard[];
}

/** A banner as placed on the homepage by an administrator. */
export interface HeroBanner {
  id: number;
  title: string | null;
  subtitle: string | null;
  alt: string | null;
  link: string | null;
  cta_label: string | null;
  theme: string | null;
  image: string | null;
  /** Falls back to `image` server-side when no phone crop is uploaded. */
  mobile_image: string | null;
}

/** One tile in a "shop the category" strip. */
export interface CollectionTile {
  id: number;
  category_id: number;
  name: string;
  product_count: number;
  image: string | null;
}

export interface CategoryCollection {
  id: number;
  title: string;
  tiles: CollectionTile[];
}

export interface HomeFeed {
  /** Ready in Tanzania now. */
  local: ProductCard[];
  /** Sourced from abroad, cheaper, on the way. */
  imports: ProductCard[];
  /** Listings from sellers an administrator has vetted. */
  verified: ProductCard[];
  /** Kept for the Flutter app; the website reads `hero`. */
  banners: Banner[];
  hero: HeroBanner[];
  hero_side: HeroBanner | null;
  promos: HeroBanner[];
  categories: Omit<Category, "subcategories">[];
  collections: CategoryCollection[];
  shelves: Shelf[];
  deals: ProductCard[];
}

export interface VendorSummary {
  id: number;
  name: string;
  logo: string | null;
  product_count: number;
  is_verified: boolean;
  member_since: string | null;
}

export interface ListingMeta {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  has_more: boolean;
}

export interface ListingFilters {
  price: { min: number; max: number };
  subcategories: { id: number; name: string; count: number }[];
  /** Counts either side of the local/import toggle, for the primary filter. */
  availability: { value: Availability; label: string; count: number }[];
  origins: (Country & { count: number })[];
}

export interface ProductListing {
  products: ProductCard[];
  meta: ListingMeta;
  filters: ListingFilters;
}

export interface CartLine {
  product: ProductCard;
  quantity: number;
  /**
   * Which buying option was chosen, when the shopper picked the imported
   * alternative rather than the product's own offer. Undefined means the
   * primary offer, which is every line placed before options existed.
   */
  option?: BuyingOption;
}

export interface OrderItem {
  id: number;
  product: { id: number; name: string; image: string | null } | null;
  vendor: string | null;
  quantity: number;
  price: number;
  total: number;
  status: string;
  sourcing: Sourcing;
}

/** One stop on the order journey, as the tracking screen renders it. */
export interface TimelineStep {
  status: string;
  title: string;
  note: string | null;
  /** Name the frontend maps to a glyph — receipt, plane, truck, check… */
  icon: string;
  state: "done" | "current" | "upcoming";
  location: string | null;
  happened_at: string | null;
}

export interface OrderFulfilment {
  type: Availability;
  is_local: boolean;
  label: string;
  origin: Country | null;
  destination: Country | null;
  eta: LeadTime | null;
  estimated_arrival_at: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipping_method: string | null;
}

/** A last-mile job attached to an order — 2KONECT Rides. */
export interface DeliveryRequest {
  reference: string;
  order_reference?: string;
  mode: "delivery" | "pickup";
  status: string;
  status_label: string;
  recipient_name: string;
  recipient_phone: string;
  address: string | null;
  pickup_point: string | null;
  preferred_date: string | null;
  preferred_window: string | null;
  fee: number;
  courier_name: string | null;
  courier_phone: string | null;
  created_at?: string | null;
}

export interface DeliveryOptions {
  available: boolean;
  modes: { value: "delivery" | "pickup"; label: string; note: string; fee: number }[];
  pickup_points: { id: string; name: string; address: string }[];
  windows: string[];
}

/** A sourcing request: "find this for me". */
export interface SourcingRequest {
  reference: string;
  name: string;
  description: string | null;
  brand: string | null;
  quantity: number;
  budget_max: number | null;
  image: string | null;
  status: string;
  status_label: string;
  step: number;
  total_steps: number;
  is_open: boolean;
  quote: {
    price: number;
    currency: string;
    eta_min: number | null;
    eta_max: number | null;
    quoted_at: string | null;
  } | null;
  note: string | null;
  created_at: string | null;
}

/** An application to sell on 2KONECT. */
export interface VendorApplication {
  reference: string;
  business_name: string;
  status: string;
  status_label: string;
  note: string | null;
  reviewed_at: string | null;
  created_at: string | null;
}

export interface Order {
  reference: string;
  status: string;
  status_label: string;
  fulfilment: OrderFulfilment;
  timeline: TimelineStep[];
  can_cancel: boolean;
  can_request_delivery: boolean;
  delivery_request: DeliveryRequest | null;
  placed_at: string | null;
  item_count: number;
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string;
  payment_method: string | null;
  delivery_address: string | null;
  customer_phone: string | null;
  items: OrderItem[];
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: "user" | "vendor" | "admin";
  vendor?: {
    id: number;
    business_name: string;
    is_approved: boolean;
    logo?: string | null;
  } | null;
}

/** A saved delivery address. Mirrors Api\Shop\AddressController::present(). */
export interface Address {
  id: number;
  full_name: string;
  phone: string;
  region: string;
  city: string;
  district: string | null;
  street: string | null;
  details: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  /** Courier-readable single line, composed by the backend. */
  formatted: string;
}

/** The writable subset of an address. */
export type AddressInput = Omit<Address, "id" | "formatted">;
