import 'common.dart';
import 'json.dart';
import 'product.dart';

class Subcategory {
  const Subcategory({
    required this.id,
    required this.name,
    this.icon,
    this.image,
    this.productCount = 0,
  });

  final int id;
  final String name;
  final String? icon;
  final String? image;
  final int productCount;

  factory Subcategory.fromJson(Map<String, dynamic> json) => Subcategory(
        id: asInt(json['id']),
        name: asString(json['name']),
        icon: asStringOrNull(json['icon']),
        image: asStringOrNull(json['image']),
        productCount: asInt(json['product_count']),
      );
}

class Category {
  const Category({
    required this.id,
    required this.name,
    required this.productCount,
    required this.subcategories,
    this.icon,
    this.image,
  });

  final int id;
  final String name;
  final String? icon;
  final String? image;
  final int productCount;
  final List<Subcategory> subcategories;

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: asInt(json['id']),
        name: asString(json['name']),
        icon: asStringOrNull(json['icon']),
        image: asStringOrNull(json['image']),
        productCount: asInt(json['product_count']),
        subcategories: asList(json['subcategories'], Subcategory.fromJson),
      );
}

/// A banner as placed on the home screen by an administrator.
class HeroBanner {
  const HeroBanner({
    required this.id,
    this.title,
    this.subtitle,
    this.alt,
    this.link,
    this.ctaLabel,
    this.theme,
    this.image,
    this.mobileImage,
  });

  final int id;
  final String? title;
  final String? subtitle;
  final String? alt;
  final String? link;
  final String? ctaLabel;
  final String? theme;
  final String? image;

  /// Falls back to `image` server-side when no phone crop is uploaded — which
  /// is exactly the one the app should prefer.
  final String? mobileImage;

  String? get artwork => mobileImage ?? image;

  factory HeroBanner.fromJson(Map<String, dynamic> json) => HeroBanner(
        id: asInt(json['id']),
        title: asStringOrNull(json['title']),
        subtitle: asStringOrNull(json['subtitle']),
        alt: asStringOrNull(json['alt']),
        link: asStringOrNull(json['link']),
        ctaLabel: asStringOrNull(json['cta_label']),
        theme: asStringOrNull(json['theme']),
        image: asStringOrNull(json['image']),
        mobileImage: asStringOrNull(json['mobile_image']),
      );

  static HeroBanner? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : HeroBanner.fromJson(map);
  }
}

class Shelf {
  const Shelf({required this.id, required this.title, required this.products});

  final int id;
  final String title;
  final List<ProductCardModel> products;

  factory Shelf.fromJson(Map<String, dynamic> json) => Shelf(
        id: asInt(json['id']),
        title: asString(json['title']),
        products: asList(json['products'], ProductCardModel.fromJson),
      );
}

/// One tile in a "shop the category" strip.
class CollectionTile {
  const CollectionTile({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.productCount,
    this.image,
  });

  final int id;
  final int categoryId;
  final String name;
  final int productCount;
  final String? image;

  factory CollectionTile.fromJson(Map<String, dynamic> json) => CollectionTile(
        id: asInt(json['id']),
        categoryId: asInt(json['category_id']),
        name: asString(json['name']),
        productCount: asInt(json['product_count']),
        image: asStringOrNull(json['image']),
      );
}

class CategoryCollection {
  const CategoryCollection({required this.id, required this.title, required this.tiles});

  final int id;
  final String title;
  final List<CollectionTile> tiles;

  factory CategoryCollection.fromJson(Map<String, dynamic> json) => CategoryCollection(
        id: asInt(json['id']),
        title: asString(json['title']),
        tiles: asList(json['tiles'], CollectionTile.fromJson),
      );
}

/// Everything the home screen renders, in one request.
class HomeFeed {
  const HomeFeed({
    required this.local,
    required this.imports,
    required this.verified,
    required this.hero,
    required this.promos,
    required this.categories,
    required this.collections,
    required this.shelves,
    required this.deals,
    required this.origins,
    required this.deliveryWindows,
    this.heroSide,
  });

  /// Ready in Tanzania now.
  final List<ProductCardModel> local;

  /// Sourced from abroad, cheaper, on the way.
  final List<ProductCardModel> imports;

  /// Listings from sellers an administrator has vetted.
  final List<ProductCardModel> verified;
  final List<HeroBanner> hero;
  final HeroBanner? heroSide;
  final List<HeroBanner> promos;
  final List<Category> categories;
  final List<CategoryCollection> collections;
  final List<Shelf> shelves;
  final List<ProductCardModel> deals;
  final List<CountryFacet> origins;

  /// `{3: 2441, 10: 2511, …}` — products promised within each window.
  final Map<int, int> deliveryWindows;

  bool get isEmpty =>
      local.isEmpty && imports.isEmpty && verified.isEmpty && deals.isEmpty && shelves.isEmpty;

  factory HomeFeed.fromJson(Map<String, dynamic> json) {
    final windows = <int, int>{};
    final raw = asMapOrNull(json['delivery_windows']);
    raw?.forEach((key, value) {
      final days = int.tryParse(key);
      if (days != null) windows[days] = asInt(value);
    });

    return HomeFeed(
      local: asList(json['local'], ProductCardModel.fromJson),
      imports: asList(json['imports'], ProductCardModel.fromJson),
      verified: asList(json['verified'], ProductCardModel.fromJson),
      hero: asList(json['hero'], HeroBanner.fromJson),
      heroSide: HeroBanner.maybe(json['hero_side']),
      promos: asList(json['promos'], HeroBanner.fromJson),
      categories: asList(json['categories'], Category.fromJson),
      collections: asList(json['collections'], CategoryCollection.fromJson),
      shelves: asList(json['shelves'], Shelf.fromJson),
      deals: asList(json['deals'], ProductCardModel.fromJson),
      origins: asList(json['origins'], CountryFacet.fromJson),
      deliveryWindows: windows,
    );
  }
}

class VendorSummary {
  const VendorSummary({
    required this.id,
    required this.name,
    required this.productCount,
    required this.isVerified,
    this.logo,
    this.memberSince,
  });

  final int id;
  final String name;
  final String? logo;
  final int productCount;
  final bool isVerified;
  final String? memberSince;

  factory VendorSummary.fromJson(Map<String, dynamic> json) => VendorSummary(
        id: asInt(json['id']),
        name: asString(json['name']),
        logo: asStringOrNull(json['logo']),
        productCount: asInt(json['product_count']),
        isVerified: asBool(json['is_verified']),
        memberSince: asStringOrNull(json['member_since']),
      );
}

class ListingMeta {
  const ListingMeta({
    required this.total,
    required this.perPage,
    required this.currentPage,
    required this.lastPage,
    required this.hasMore,
  });

  final int total;
  final int perPage;
  final int currentPage;
  final int lastPage;
  final bool hasMore;

  factory ListingMeta.fromJson(Map<String, dynamic> json) => ListingMeta(
        total: asInt(json['total']),
        perPage: asInt(json['per_page'], 24),
        currentPage: asInt(json['current_page'], 1),
        lastPage: asInt(json['last_page'], 1),
        hasMore: asBool(json['has_more']),
      );

  static const empty =
      ListingMeta(total: 0, perPage: 24, currentPage: 1, lastPage: 1, hasMore: false);
}

class PriceRange {
  const PriceRange({required this.min, required this.max});

  final double min;
  final double max;

  factory PriceRange.fromJson(Map<String, dynamic> json) =>
      PriceRange(min: asDouble(json['min']), max: asDouble(json['max']));

  static const none = PriceRange(min: 0, max: 0);

  bool get isUsable => max > min;
}

class AvailabilityFacet {
  const AvailabilityFacet({required this.value, required this.label, required this.count});

  final Availability value;
  final String label;
  final int count;

  factory AvailabilityFacet.fromJson(Map<String, dynamic> json) => AvailabilityFacet(
        value: Availability.parse(json['value']),
        label: asString(json['label']),
        count: asInt(json['count']),
      );
}

class SubcategoryFacet {
  const SubcategoryFacet({required this.id, required this.name, required this.count});

  final int id;
  final String name;
  final int count;

  factory SubcategoryFacet.fromJson(Map<String, dynamic> json) => SubcategoryFacet(
        id: asInt(json['id']),
        name: asString(json['name']),
        count: asInt(json['count']),
      );
}

/// The facets the server computed for the *current* result set — which is why
/// the price slider's ceiling is never a hard-coded figure.
class ListingFilters {
  const ListingFilters({
    required this.price,
    required this.subcategories,
    required this.availability,
    required this.origins,
  });

  final PriceRange price;
  final List<SubcategoryFacet> subcategories;
  final List<AvailabilityFacet> availability;
  final List<CountryFacet> origins;

  factory ListingFilters.fromJson(Map<String, dynamic> json) => ListingFilters(
        price: json['price'] == null ? PriceRange.none : PriceRange.fromJson(asMap(json['price'])),
        subcategories: asList(json['subcategories'], SubcategoryFacet.fromJson),
        availability: asList(json['availability'], AvailabilityFacet.fromJson),
        origins: asList(json['origins'], CountryFacet.fromJson),
      );

  static const empty = ListingFilters(
    price: PriceRange.none,
    subcategories: [],
    availability: [],
    origins: [],
  );
}

class ProductListing {
  const ProductListing({
    required this.products,
    required this.meta,
    required this.filters,
  });

  final List<ProductCardModel> products;
  final ListingMeta meta;
  final ListingFilters filters;

  factory ProductListing.fromJson(Map<String, dynamic> json) => ProductListing(
        products: asList(json['products'], ProductCardModel.fromJson),
        meta: json['meta'] == null ? ListingMeta.empty : ListingMeta.fromJson(asMap(json['meta'])),
        filters: json['filters'] == null
            ? ListingFilters.empty
            : ListingFilters.fromJson(asMap(json['filters'])),
      );

  static const empty =
      ProductListing(products: [], meta: ListingMeta.empty, filters: ListingFilters.empty);
}

/// A category landing payload — `/shop/categories/{id}`.
class CategoryPage {
  const CategoryPage({
    required this.category,
    required this.subcategories,
    required this.shelves,
  });

  final Ref category;
  final List<Subcategory> subcategories;
  final List<Shelf> shelves;

  factory CategoryPage.fromJson(Map<String, dynamic> json) => CategoryPage(
        category: Ref.fromJson(asMap(json['category'])),
        subcategories: asList(json['subcategories'], Subcategory.fromJson),
        shelves: asList(json['shelves'], Shelf.fromJson),
      );
}

/// Type-ahead results.
class Suggestions {
  const Suggestions({required this.products, required this.categories});

  final List<Ref> products;
  final List<Ref> categories;

  bool get isEmpty => products.isEmpty && categories.isEmpty;

  factory Suggestions.fromJson(Map<String, dynamic> json) => Suggestions(
        products: asList(json['products'], Ref.fromJson),
        categories: asList(json['categories'], Ref.fromJson),
      );

  static const empty = Suggestions(products: [], categories: []);
}
