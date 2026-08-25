import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import '../models/catalog.dart';
import '../models/common.dart';
import '../models/json.dart';
import '../models/product.dart';

/// How a listing is ordered. The wire values are Laravel's own.
enum ProductSort {
  relevance('relevance', 'listing.sortRecommended'),
  newest('newest', 'listing.sortNewest'),
  priceAsc('price_asc', 'listing.sortPriceAsc'),
  priceDesc('price_desc', 'listing.sortPriceDesc'),
  rating('rating', 'listing.sortRating'),
  discount('discount', 'listing.sortDiscount');

  const ProductSort(this.wire, this.labelKey);

  final String wire;
  final String labelKey;

  static ProductSort parse(String? value) {
    for (final sort in ProductSort.values) {
      if (sort.wire == value) return sort;
    }
    return ProductSort.newest;
  }
}

/// Everything `/shop/products` accepts, as one immutable value.
///
/// Kept as a value type so a screen can hold "the filters as they are now",
/// hand a modified copy to the provider, and have the request key change with
/// it — which is what makes the results, the chips and the applied-count all
/// agree without any of them owning the truth.
class ProductQuery {
  const ProductQuery({
    this.categoryId,
    this.subcategoryId,
    this.vendorId,
    this.q,
    this.minPrice,
    this.maxPrice,
    this.inStock,
    this.onSale,
    this.rating,
    this.availability,
    this.sourceCountry,
    this.verified,
    this.maxDays,
    this.sort = ProductSort.newest,
    this.page = 1,
    this.perPage = 24,
  });

  final int? categoryId;
  final int? subcategoryId;
  final int? vendorId;
  final String? q;

  /// Plain numbers. Never a formatted string — "TZS 1,500,000" is a label, and
  /// the API is sent 1500000.
  final double? minPrice;
  final double? maxPrice;
  final bool? inStock;
  final bool? onSale;
  final int? rating;

  /// The defining filter: is it here, or is it coming?
  final Availability? availability;
  final String? sourceCountry;

  /// Verified sellers only.
  final bool? verified;

  /// "I need it within N days" — matched against the promised upper bound.
  final int? maxDays;
  final ProductSort sort;
  final int page;
  final int perPage;

  ProductQuery copyWith({
    Object? categoryId = _keep,
    Object? subcategoryId = _keep,
    Object? vendorId = _keep,
    Object? q = _keep,
    Object? minPrice = _keep,
    Object? maxPrice = _keep,
    Object? inStock = _keep,
    Object? onSale = _keep,
    Object? rating = _keep,
    Object? availability = _keep,
    Object? sourceCountry = _keep,
    Object? verified = _keep,
    Object? maxDays = _keep,
    ProductSort? sort,
    int? page,
    int? perPage,
  }) =>
      ProductQuery(
        categoryId: categoryId == _keep ? this.categoryId : categoryId as int?,
        subcategoryId: subcategoryId == _keep ? this.subcategoryId : subcategoryId as int?,
        vendorId: vendorId == _keep ? this.vendorId : vendorId as int?,
        q: q == _keep ? this.q : q as String?,
        minPrice: minPrice == _keep ? this.minPrice : minPrice as double?,
        maxPrice: maxPrice == _keep ? this.maxPrice : maxPrice as double?,
        inStock: inStock == _keep ? this.inStock : inStock as bool?,
        onSale: onSale == _keep ? this.onSale : onSale as bool?,
        rating: rating == _keep ? this.rating : rating as int?,
        availability: availability == _keep ? this.availability : availability as Availability?,
        sourceCountry: sourceCountry == _keep ? this.sourceCountry : sourceCountry as String?,
        verified: verified == _keep ? this.verified : verified as bool?,
        maxDays: maxDays == _keep ? this.maxDays : maxDays as int?,
        sort: sort ?? this.sort,
        page: page ?? this.page,
        perPage: perPage ?? this.perPage,
      );

  static const _keep = Object();

  Map<String, dynamic> toParams() => {
        'category_id': categoryId,
        'subcategory_id': subcategoryId,
        'vendor_id': vendorId,
        'q': q,
        // Sent as numbers. A price the customer typed is parsed to a number
        // before it ever reaches here.
        'min_price': minPrice == null ? null : _plain(minPrice!),
        'max_price': maxPrice == null ? null : _plain(maxPrice!),
        'in_stock': inStock,
        'on_sale': onSale,
        'rating': rating,
        'availability': availability?.wire,
        'source_country': sourceCountry,
        'verified': verified,
        'max_days': maxDays,
        'sort': sort.wire,
        'page': page,
        'per_page': perPage,
      };

  static num _plain(double value) =>
      value == value.roundToDouble() ? value.round() : value;

  /// How many *shopper-chosen* filters are on — the number on the Filters
  /// button. Sort, paging and the screen's own scope are not filters.
  int appliedCount({int? scopedCategoryId, Availability? scopedAvailability}) {
    var count = 0;
    if (subcategoryId != null) count++;
    if (minPrice != null) count++;
    if (maxPrice != null) count++;
    if (inStock == true) count++;
    if (onSale == true) count++;
    if (rating != null) count++;
    if (verified == true) count++;
    if (maxDays != null) count++;
    if (sourceCountry != null) count++;
    if (categoryId != null && categoryId != scopedCategoryId) count++;
    if (availability != null && availability != scopedAvailability) count++;
    return count;
  }

  /// Identity for caching. Page is included: page 2 is a different request.
  String get cacheKey => toParams().entries
      .where((e) => e.value != null)
      .map((e) => '${e.key}=${e.value}')
      .toList()
      .join('&');

  @override
  bool operator ==(Object other) => other is ProductQuery && other.cacheKey == cacheKey;

  @override
  int get hashCode => cacheKey.hashCode;
}

/// The public catalogue. Every endpoint here is browsable signed out.
class CatalogService {
  const CatalogService(this._api);

  final ApiClient _api;

  Future<HomeFeed> home() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/home');
    return HomeFeed.fromJson(data);
  }

  Future<List<Category>> categories() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/categories');
    return asList(data['categories'], Category.fromJson);
  }

  Future<CategoryPage> category(int id) async {
    final data = await _api.get<Map<String, dynamic>>('/shop/categories/$id');
    return CategoryPage.fromJson(data);
  }

  Future<ProductListing> products(ProductQuery query, {CancelToken? cancelToken}) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/shop/products',
      query: query.toParams(),
      cancelToken: cancelToken,
    );
    return ProductListing.fromJson(data);
  }

  Future<ProductPage> product(int id) async {
    final data = await _api.get<Map<String, dynamic>>('/shop/products/$id');
    return ProductPage.fromJson(data);
  }

  Future<Suggestions> suggest(String term, {CancelToken? cancelToken}) async {
    final trimmed = term.trim();
    if (trimmed.length < 2) return Suggestions.empty;
    final data = await _api.get<Map<String, dynamic>>(
      '/shop/products/suggest',
      query: {'q': trimmed},
      cancelToken: cancelToken,
    );
    return Suggestions.fromJson(data);
  }

  Future<List<VendorSummary>> vendors() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/vendors');
    return asList(data['vendors'], VendorSummary.fromJson);
  }

  /// Prices a basket server-side. Deliberately not cached: it is about *this*
  /// shopper's quantities, and a quantity tier makes the answer differ per
  /// basket rather than per product.
  Future<ProductCardModel?> previewCard(int id) async {
    try {
      final page = await product(id);
      return page.product.toCard();
    } on Exception {
      return null;
    }
  }
}
