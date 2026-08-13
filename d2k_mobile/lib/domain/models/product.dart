import 'currency.dart';
import 'vendor.dart';

/// A selectable product variant (colour, size, capacity…).
class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.label,
    this.priceDeltaBase = 0,
    this.inStock = true,
  });

  final String id;
  final String label;

  /// Difference from the product's base price, in TZS.
  final double priceDeltaBase;
  final bool inStock;
}

class ProductVariantGroup {
  const ProductVariantGroup({
    required this.name,
    required this.options,
  });

  final String name;
  final List<ProductVariant> options;
}

class ProductReview {
  const ProductReview({
    required this.author,
    required this.rating,
    required this.title,
    required this.body,
    required this.timeAgo,
    this.verified = true,
  });

  final String author;
  final double rating;
  final String title;
  final String body;
  final String timeAgo;
  final bool verified;
}

class Product {
  const Product({
    required this.id,
    required this.title,
    required this.brand,
    required this.categoryId,
    required this.subcategory,
    required this.priceBase,
    required this.images,
    this.originalPriceBase,
    this.rating = 0,
    this.reviewCount = 0,
    this.isBestSeller = false,
    this.isExpress = true,
    this.isGlobal = false,
    this.isSponsored = false,
    this.rankLabel,
    this.stock = 25,
    this.soldRecently,
    this.sellerName = '',
    this.description = '',
    this.shortDescription = '',
    this.highlights = const [],
    this.specifications = const {},
    this.variantGroups = const [],
    this.reviews = const [],
    this.flashSaleUnitsLeft,
    this.dealLabel,
    this.vendor,
  });

  final String id;
  final String title;
  final String brand;
  final String categoryId;
  final String subcategory;

  /// Price in TZS — the single source of truth for money on this product.
  final double priceBase;
  final double? originalPriceBase;

  final List<String> images;
  final double rating;
  final int reviewCount;
  final bool isBestSeller;
  final bool isExpress;
  final bool isGlobal;
  final bool isSponsored;
  final String? rankLabel;
  final int stock;
  final String? soldRecently;
  /// The store's display name. Empty when the payload carried no vendor —
  /// there is no invented default, because a plausible-looking seller name is
  /// still a fabricated one.
  final String sellerName;
  /// Long-form copy written by the seller. Deliberately separate from
  /// [specifications]: a description is prose, specifications are structured
  /// attributes, and merging them loses both.
  final String description;

  /// The one-line summary shown on cards, where the backend has one.
  final String shortDescription;

  final List<String> highlights;

  /// Admin-defined attributes for this product — Colour, Storage, Condition…
  /// Insertion order is the order the backend returned.
  final Map<String, String> specifications;

  final List<ProductVariantGroup> variantGroups;
  final List<ProductReview> reviews;
  final int? flashSaleUnitsLeft;
  final String? dealLabel;

  /// The store selling this item. Null on list payloads that omit it.
  final Vendor? vendor;

  bool get hasDescription => description.trim().isNotEmpty;
  bool get hasSpecifications => specifications.isNotEmpty;

  Money get price => Money(priceBase);
  Money? get originalPrice =>
      originalPriceBase == null ? null : Money(originalPriceBase!);

  bool get hasDiscount =>
      originalPriceBase != null && originalPriceBase! > priceBase;

  int get discountPercent => hasDiscount
      ? (((originalPriceBase! - priceBase) / originalPriceBase!) * 100).round()
      : 0;

  bool get inStock => stock > 0;

  String get primaryImage => images.isEmpty ? '' : images.first;

  /// Free-text haystack used by the search repository.
  String get searchIndex =>
      '$title $brand $subcategory $categoryId'.toLowerCase();
}
