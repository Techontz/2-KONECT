import '../../data/remote_catalog_source.dart';
import '../models/catalog.dart';
import '../models/product.dart';
import '../models/vendor.dart';

enum SortOption {
  recommended('Recommended', null),
  priceLowHigh('Price: low to high', 'price_asc'),
  priceHighLow('Price: high to low', 'price_desc'),
  topRated('Top rated', 'rating'),
  biggestDiscount('Biggest discount', 'discount'),
  newest('New arrivals', 'newest');

  const SortOption(this.label, this.wire);

  final String label;

  /// What the backend calls this ordering, or null for its default.
  final String? wire;
}

class ProductFilter {
  const ProductFilter({
    this.categoryId,
    this.subcategory,
    this.brands = const {},
    this.minRating,
    this.expressOnly = false,
    this.dealsOnly = false,
    this.maxPriceBase,
    this.minPriceBase,
  });

  final String? categoryId;
  final String? subcategory;
  final Set<String> brands;
  final double? minRating;
  final bool expressOnly;
  final bool dealsOnly;
  final double? maxPriceBase;
  final double? minPriceBase;

  bool get isActive =>
      brands.isNotEmpty ||
      minRating != null ||
      expressOnly ||
      dealsOnly ||
      maxPriceBase != null ||
      minPriceBase != null;

  int get activeCount => [
        brands.isNotEmpty,
        minRating != null,
        expressOnly,
        dealsOnly,
        maxPriceBase != null || minPriceBase != null,
      ].where((e) => e).length;

  ProductFilter copyWith({
    String? categoryId,
    String? subcategory,
    Set<String>? brands,
    double? minRating,
    bool? expressOnly,
    bool? dealsOnly,
    double? maxPriceBase,
    double? minPriceBase,
    bool clearRating = false,
    bool clearPrice = false,
    bool clearSubcategory = false,
  }) =>
      ProductFilter(
        categoryId: categoryId ?? this.categoryId,
        subcategory: clearSubcategory ? null : (subcategory ?? this.subcategory),
        brands: brands ?? this.brands,
        minRating: clearRating ? null : (minRating ?? this.minRating),
        expressOnly: expressOnly ?? this.expressOnly,
        dealsOnly: dealsOnly ?? this.dealsOnly,
        maxPriceBase: clearPrice ? null : (maxPriceBase ?? this.maxPriceBase),
        minPriceBase: clearPrice ? null : (minPriceBase ?? this.minPriceBase),
      );
}

/// Read model for the whole catalogue, served by the Laravel API.
///
/// There is no local catalogue: every product, category and vendor here came
/// from the same database the website reads. Results are cached in memory only
/// so a product already fetched can be resolved by id (wishlist, recently
/// viewed, cart) without a second round trip — the cache is never a fallback
/// for a failed request, because showing stale-but-plausible data instead of an
/// error is exactly how a broken app looks healthy.
class CatalogRepository {
  CatalogRepository(this._remote);

  final RemoteCatalogSource _remote;

  final Map<String, Product> _byId = {};
  List<Category>? _categories;

  /// Products seen this session, newest first. Screens use it for instant
  /// resolution by id; it is not a catalogue.
  Iterable<Product> get cached => _byId.values;

  void _remember(Iterable<Product> products) {
    for (final product in products) {
      // A detailed record must not be replaced by a slimmer list entry.
      final existing = _byId[product.id];
      if (existing != null &&
          existing.specifications.isNotEmpty &&
          product.specifications.isEmpty) {
        continue;
      }
      _byId[product.id] = product;
    }
  }

  /// Already-loaded product, or null. Callers that need certainty use
  /// [product] instead.
  Product? productById(String id) => _byId[id];

  Future<Product> product(String id) async {
    final fresh = await _remote.product(id);
    _remember([fresh]);
    return fresh;
  }

  Future<HomeFeed> home() async {
    final feed = await _remote.home();

    _remember(feed.deals);
    for (final shelf in feed.shelves) {
      _remember(shelf.products);
    }
    for (final collection in feed.collections) {
      _remember(collection.products);
    }
    if (feed.categories.isNotEmpty) _categories = feed.categories;

    return HomeFeed(
      hero: feed.hero,
      heroSide: feed.heroSide,
      promos: feed.promos,
      categories: feed.categories,
      collections: feed.collections,
      deals: feed.deals,
      shelves: feed.shelves,
    );
  }

  Future<List<Category>> categories({bool refresh = false}) async {
    if (!refresh && _categories != null && _categories!.isNotEmpty) {
      return _categories!;
    }
    _categories = await _remote.categories();
    return _categories!;
  }

  List<Category> get categoriesSync => _categories ?? const [];

  Category? categoryById(String id) {
    for (final category in categoriesSync) {
      if (category.id == id) return category;
    }
    return null;
  }

  /// One page of products. Filtering and sorting are done by the backend so
  /// the app never has to hold the catalogue to answer a query.
  Future<ProductPage> list({
    String? categoryId,
    String? subcategoryId,
    String? query,
    String? vendorId,
    ProductFilter filter = const ProductFilter(),
    SortOption sort = SortOption.recommended,
    int page = 1,
    int perPage = 24,
  }) async {
    final listing = await _remote.products(
      categoryId: categoryId ?? filter.categoryId,
      subcategoryId: subcategoryId,
      query: query,
      sort: sort.wire,
      inStock: filter.expressOnly ? true : null,
      onSale: filter.dealsOnly ? true : null,
      vendorId: vendorId,
      minPrice: filter.minPriceBase,
      maxPrice: filter.maxPriceBase,
      page: page,
      perPage: perPage,
    );

    _remember(listing.products);

    // Anything the API cannot express is applied here, over this page only.
    final refined = _refine(listing.products, filter);

    return ProductPage(
      products: refined,
      total: listing.total,
      page: listing.page,
      hasMore: listing.hasMore,
    );
  }

  Future<List<Product>> byCategory(String categoryId, {int limit = 24}) async {
    final page = await list(categoryId: categoryId, perPage: limit);
    return page.products;
  }

  Future<List<Product>> search(String query, {int limit = 40}) async {
    final page = await list(query: query, perPage: limit);
    return page.products;
  }

  Future<List<String>> suggestions(String query) => _remote.suggest(query);

  Future<List<Vendor>> vendors() => _remote.vendors();

  Future<List<Product>> byVendor(String vendorId, {int limit = 24}) async {
    final page = await list(vendorId: vendorId, perPage: limit);
    return page.products;
  }

  /// Products shown under "You may also like" — same subcategory, from the
  /// backend rather than from whatever happens to be in memory.
  Future<List<Product>> related(Product product, {int limit = 10}) async {
    final page = await list(
      categoryId: product.categoryId,
      perPage: limit + 1,
    );
    return page.products.where((p) => p.id != product.id).take(limit).toList();
  }

  /// Brand facet, derived from the page in hand. The catalogue has no brand
  /// column — these are seller names — so this stays a local convenience.
  List<String> brandsFrom(Iterable<Product> products) {
    final set = products
        .map((p) => p.brand)
        .where((b) => b.trim().isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    return set;
  }

  List<Product> _refine(List<Product> source, ProductFilter filter) {
    if (!filter.isActive && filter.subcategory == null) return source;

    return source.where((p) {
      if (filter.subcategory != null && p.subcategory != filter.subcategory) {
        return false;
      }
      if (filter.brands.isNotEmpty && !filter.brands.contains(p.brand)) {
        return false;
      }
      if (filter.minRating != null && p.rating < filter.minRating!) return false;
      if (filter.dealsOnly && !p.hasDiscount) return false;
      if (filter.expressOnly && !p.inStock) return false;
      return true;
    }).toList();
  }

  /// Sorting for lists already in memory (a shelf, a cached page).
  List<Product> applySort(List<Product> source, SortOption sort) {
    final list = List<Product>.from(source);
    switch (sort) {
      case SortOption.priceLowHigh:
        list.sort((a, b) => a.priceBase.compareTo(b.priceBase));
      case SortOption.priceHighLow:
        list.sort((a, b) => b.priceBase.compareTo(a.priceBase));
      case SortOption.topRated:
        list.sort((a, b) => b.rating.compareTo(a.rating));
      case SortOption.biggestDiscount:
        list.sort((a, b) => b.discountPercent.compareTo(a.discountPercent));
      case SortOption.newest:
        return list.reversed.toList();
      case SortOption.recommended:
        list.sort((a, b) {
          final byBest = (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
          return byBest != 0 ? byBest : b.rating.compareTo(a.rating);
        });
    }
    return list;
  }
}

/// The home screen's content, all of it backend-controlled.
class HomeFeed {
  const HomeFeed({
    required this.hero,
    required this.promos,
    required this.categories,
    required this.collections,
    required this.deals,
    required this.shelves,
    this.heroSide,
  });

  final List<RemoteBanner> hero;
  final RemoteBanner? heroSide;
  final List<RemoteBanner> promos;
  final List<Category> categories;
  final List<RemoteCollection> collections;
  final List<Product> deals;
  final List<RemoteShelf> shelves;

  static const empty = HomeFeed(
    hero: [],
    promos: [],
    categories: [],
    collections: [],
    deals: [],
    shelves: [],
  );

  bool get isEmpty =>
      hero.isEmpty &&
      categories.isEmpty &&
      deals.isEmpty &&
      shelves.isEmpty &&
      collections.isEmpty;
}

class ProductPage {
  const ProductPage({
    required this.products,
    required this.total,
    required this.page,
    required this.hasMore,
  });

  final List<Product> products;
  final int total;
  final int page;
  final bool hasMore;

  static const empty = ProductPage(products: [], total: 0, page: 1, hasMore: false);
}
