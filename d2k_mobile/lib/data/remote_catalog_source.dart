import 'package:flutter/material.dart' show Color;

import '../domain/models/catalog.dart';
import '../domain/models/product.dart';
import '../domain/models/vendor.dart';
import 'api_client.dart';

/// Maps the backend's storefront JSON onto the app's domain models.
///
/// The Laravel API is the source of truth — the same `/shop/*` endpoints the
/// website calls. This file is the only place that knows the wire format, so a
/// change to the contract is a change here rather than in every screen.
class RemoteCatalogSource {
  RemoteCatalogSource(this._api);

  final ApiClient _api;

  /// Everything the home screen needs, in one request.
  Future<RemoteHomeFeed> home() async {
    final body = await _api.get('/shop/home');

    return RemoteHomeFeed(
      hero: _banners(body['hero']),
      heroSide: _banner(body['hero_side'] as Map<String, dynamic>?),
      promos: _banners(body['promos']),
      categories: _categoryList(body['categories']),
      collections: [
        for (final raw in (body['collections'] as List? ?? const []))
          RemoteCollection(
            id: '${(raw as Map)['id'] ?? ''}',
            title: '${raw['title'] ?? ''}'.trim(),
            subtitle: '${raw['subtitle'] ?? ''}'.trim(),
            categoryId: raw['category_id'] == null ? null : '${raw['category_id']}',
            products: _productList(raw['products']),
          ),
      ],
      deals: _productList(body['deals']),
      shelves: [
        for (final shelf in (body['shelves'] as List? ?? const []))
          RemoteShelf(
            id: '${(shelf as Map)['id']}',
            title: '${shelf['title']}'.trim(),
            products: _productList(shelf['products']),
          ),
      ],
      banners: _banners(body['banners']),
    );
  }

  Future<List<Category>> categories() async {
    final body = await _api.get('/shop/categories');
    return _categoryList(body['categories'], withSubcategories: true);
  }

  Future<RemoteListing> products({
    String? categoryId,
    String? subcategoryId,
    String? query,
    String? sort,
    bool? inStock,
    bool? onSale,
    String? vendorId,
    num? minPrice,
    num? maxPrice,
    int page = 1,
    int perPage = 24,
  }) async {
    final body = await _api.get('/shop/products', query: {
      if (categoryId != null && categoryId.isNotEmpty) 'category_id': categoryId,
      if (subcategoryId != null && subcategoryId.isNotEmpty) 'subcategory_id': subcategoryId,
      if (query != null && query.isNotEmpty) 'q': query,
      if (sort != null) 'sort': sort,
      if (inStock == true) 'in_stock': 1,
      if (onSale == true) 'on_sale': 1,
      if (vendorId != null && vendorId.isNotEmpty) 'vendor_id': vendorId,
      if (minPrice != null) 'min_price': minPrice,
      if (maxPrice != null) 'max_price': maxPrice,
      'page': page,
      'per_page': perPage,
    });

    final meta = (body['meta'] as Map?) ?? const {};

    return RemoteListing(
      products: _productList(body['products']),
      total: (meta['total'] as num?)?.toInt() ?? 0,
      page: (meta['current_page'] as num?)?.toInt() ?? page,
      lastPage: (meta['last_page'] as num?)?.toInt() ?? page,
      hasMore: meta['has_more'] == true,
    );
  }

  Future<Product> product(String id) async {
    final body = await _api.get('/shop/products/$id');
    return _product(body['product'] as Map<String, dynamic>, detailed: true);
  }

  Future<List<String>> suggest(String query) async {
    if (query.trim().length < 2) return const [];
    final body = await _api.get('/shop/products/suggest', query: {'q': query});
    return [
      for (final item in (body['suggestions'] as List? ?? const []))
        item is Map ? '${item['label'] ?? item['name'] ?? ''}' : '$item',
    ].where((s) => s.isNotEmpty).toList();
  }

  Future<List<Vendor>> vendors({int page = 1, int perPage = 30}) async {
    final body = await _api.get('/shop/vendors', query: {
      'page': page,
      'per_page': perPage,
    });
    return [
      for (final raw in (body['vendors'] as List? ?? const []))
        Vendor.fromJson(raw as Map<String, dynamic>)!,
    ];
  }

  /* ------------------------------------------------------------------ */
  /* mapping                                                            */
  /* ------------------------------------------------------------------ */

  List<Product> _productList(Object? raw) => [
        for (final item in (raw as List? ?? const []))
          _product(item as Map<String, dynamic>),
      ];

  Product _product(Map<String, dynamic> json, {bool detailed = false}) {
    final price = (json['price'] as Map?) ?? const {};
    final rating = (json['rating'] as Map?) ?? const {};
    final category = json['category'] as Map?;
    final subcategory = json['subcategory'] as Map?;
    final vendor = Vendor.fromJson(json['vendor'] as Map<String, dynamic>?);

    final images = [
      for (final image in (json['images'] as List? ?? const [])) '$image',
    ];
    final main = '${json['image'] ?? ''}';
    if (images.isEmpty && main.isNotEmpty) images.add(main);

    final stock = (json['stock'] as num?)?.toInt() ?? 0;
    final discount = (price['discount_percent'] as num?)?.toInt() ?? 0;

    return Product(
      id: '${json['id']}',
      title: '${json['name'] ?? ''}',
      // The catalogue has no brand column; the seller is the closest real
      // attribution, and inventing one would be fabricating product data.
      brand: vendor?.name ?? '',
      categoryId: '${category?['id'] ?? ''}',
      subcategory: '${subcategory?['name'] ?? ''}',
      priceBase: (price['current'] as num?)?.toDouble() ?? 0,
      originalPriceBase: (price['was'] as num?)?.toDouble(),
      images: images,
      rating: (rating['average'] as num?)?.toDouble() ?? 0,
      reviewCount: (rating['count'] as num?)?.toInt() ?? 0,
      isBestSeller: ((rating['average'] as num?)?.toDouble() ?? 0) >= 4.5 &&
          ((rating['count'] as num?)?.toInt() ?? 0) >= 3,
      stock: stock,
      sellerName: vendor?.name ?? '',
      vendor: vendor,
      description: '${json['description'] ?? ''}',
      shortDescription: '${json['short_description'] ?? ''}',
      specifications: _specifications(json['specifications']),
      reviews: detailed ? _reviews(json['reviews']) : const [],
      // "Only N left" is a real stock figure, not a manufactured urgency cue.
      flashSaleUnitsLeft: stock > 0 && stock <= 5 ? stock : null,
      dealLabel: discount > 0 ? '$discount% OFF' : null,
    );
  }

  /// Specifications arrive as an ordered list of label/value pairs. A map keeps
  /// the call sites simple and Dart preserves insertion order, so the backend's
  /// ordering survives.
  Map<String, String> _specifications(Object? raw) {
    final out = <String, String>{};
    for (final spec in (raw as List? ?? const [])) {
      if (spec is! Map) continue;
      final label = '${spec['label'] ?? spec['name'] ?? ''}'.trim();
      final value = '${spec['value'] ?? ''}'.trim();
      if (label.isEmpty || value.isEmpty) continue;
      final unit = '${spec['unit'] ?? ''}'.trim();
      out[label] = unit.isEmpty ? value : '$value $unit';
    }
    return out;
  }

  List<ProductReview> _reviews(Object? raw) => [
        for (final review in (raw as List? ?? const []))
          ProductReview(
            author: '${(review as Map)['author'] ?? 'Shopper'}',
            rating: (review['rating'] as num?)?.toDouble() ?? 0,
            title: '',
            body: '${review['comment'] ?? ''}',
            timeAgo: '${review['date'] ?? ''}',
            verified: true,
          ),
      ];

  List<Category> _categoryList(Object? raw, {bool withSubcategories = false}) => [
        for (final item in (raw as List? ?? const []))
          Category(
            id: '${(item as Map)['id']}',
            name: '${item['name']}'.trim(),
            image: '${item['image'] ?? ''}',
            subcategories: [
              for (final sub in (item['subcategories'] as List? ?? const []))
                Subcategory(
                  id: '${(sub as Map)['id']}',
                  name: '${sub['name']}',
                  image: '${sub['image'] ?? ''}',
                ),
            ],
          ),
      ];

  List<RemoteBanner> _banners(Object? raw) => [
        for (final item in (raw as List? ?? const []))
          _banner(item as Map<String, dynamic>)!,
      ];

  RemoteBanner? _banner(Map<String, dynamic>? json) {
    if (json == null) return null;

    String? clean(Object? v) {
      final t = v?.toString().trim() ?? '';
      return t.isEmpty || t == 'null' ? null : t;
    }

    return RemoteBanner(
      id: '${json['id'] ?? ''}',
      title: clean(json['title']) ?? '',
      subtitle: clean(json['subtitle']),
      ctaLabel: clean(json['cta_label']),
      link: clean(json['link']),
      alt: clean(json['alt']),
      // The backend crops a wide image for phones; prefer it and fall back to
      // the desktop asset so a banner without a mobile crop still shows.
      image: clean(json['image']) ?? '',
      mobileImage: clean(json['mobile_image']),
    );
  }
}

/// Presents a backend banner through the app's existing hero widgets.
///
/// The admin owns the artwork and the words; the app owns the presentation.
/// The gradient is only a backdrop for the moments before the image decodes,
/// or when a banner was saved without one.
extension RemoteBannerPresentation on RemoteBanner {
  PromoBanner toPromo() {
    // D2K's banner artwork already carries its own headline, subtitle and
    // call to action. Overlaying the same words again both duplicated them and
    // clipped the longer real ones, so the text is only drawn when there is no
    // artwork to speak for itself.
    final hasArt = hasImage;

    return PromoBanner(
        id: id,
        title: hasArt ? '' : title,
        subtitle: hasArt ? null : subtitle,
        ctaLabel: hasArt ? null : ctaLabel,
        image: bestImage,
        gradient: const [Color(0xFF16161A), Color(0xFF2C2C34)],
        // `link` is a web path such as /category?id=12 — the id is what the
        // app can act on, so it is parsed rather than followed.
        targetCategoryId: _categoryIdFromLink(link),
        targetQuery: _queryFromLink(link),
    );
  }

  static String? _categoryIdFromLink(String? link) {
    if (link == null) return null;
    final uri = Uri.tryParse(link);
    final id = uri?.queryParameters['id'];
    if (id == null || id.isEmpty) return null;
    return uri!.path.contains('categor') ? id : null;
  }

  static String? _queryFromLink(String? link) {
    if (link == null) return null;
    final uri = Uri.tryParse(link);
    final q = uri?.queryParameters['q'] ?? uri?.queryParameters['query'];
    return (q == null || q.isEmpty) ? null : q;
  }
}

/// A banner as the admin configured it.
class RemoteBanner {
  const RemoteBanner({
    required this.id,
    required this.title,
    required this.image,
    this.subtitle,
    this.ctaLabel,
    this.link,
    this.alt,
    this.mobileImage,
  });

  final String id;
  final String title;
  final String image;
  final String? subtitle;
  final String? ctaLabel;
  final String? link;
  final String? alt;
  final String? mobileImage;

  /// Phone-sized artwork when the admin supplied one.
  String get bestImage =>
      (mobileImage != null && mobileImage!.isNotEmpty) ? mobileImage! : image;

  bool get hasImage => bestImage.isNotEmpty;
}

class RemoteHomeFeed {
  const RemoteHomeFeed({
    required this.hero,
    required this.promos,
    required this.categories,
    required this.collections,
    required this.deals,
    required this.shelves,
    required this.banners,
    this.heroSide,
  });

  final List<RemoteBanner> hero;
  final RemoteBanner? heroSide;
  final List<RemoteBanner> promos;
  final List<Category> categories;
  final List<RemoteCollection> collections;
  final List<Product> deals;
  final List<RemoteShelf> shelves;
  final List<RemoteBanner> banners;

  bool get isEmpty =>
      hero.isEmpty &&
      categories.isEmpty &&
      deals.isEmpty &&
      shelves.isEmpty &&
      collections.isEmpty;
}

class RemoteCollection {
  const RemoteCollection({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.products,
    this.categoryId,
  });

  final String id;
  final String title;
  final String subtitle;
  final String? categoryId;
  final List<Product> products;
}

class RemoteShelf {
  const RemoteShelf({
    required this.id,
    required this.title,
    required this.products,
  });

  final String id;
  final String title;
  final List<Product> products;
}

class RemoteListing {
  const RemoteListing({
    required this.products,
    required this.total,
    required this.page,
    required this.lastPage,
    required this.hasMore,
  });

  final List<Product> products;
  final int total;
  final int page;
  final int lastPage;
  final bool hasMore;

  static const empty = RemoteListing(
    products: [],
    total: 0,
    page: 1,
    lastPage: 1,
    hasMore: false,
  );
}
