import 'common.dart';
import 'json.dart';

/// Flags a card renders over the image plate.
class ProductBadges {
  const ProductBadges({
    required this.lowStock,
    required this.outOfStock,
    required this.discounted,
  });

  final bool lowStock;
  final bool outOfStock;
  final bool discounted;

  factory ProductBadges.fromJson(Map<String, dynamic> json) => ProductBadges(
        lowStock: asBool(json['low_stock']),
        outOfStock: asBool(json['out_of_stock']),
        discounted: asBool(json['discounted']),
      );

  static const none = ProductBadges(lowStock: false, outOfStock: false, discounted: false);
}

/// The product as every grid, shelf and carousel renders it.
class ProductCardModel {
  const ProductCardModel({
    required this.id,
    required this.name,
    required this.price,
    required this.rating,
    required this.stock,
    required this.inStock,
    required this.sourcing,
    required this.badges,
    this.image,
    this.images = const [],
    this.category,
    this.subcategory,
    this.vendor,
    this.hasBulkPricing = false,
    this.hasOptions = false,
    this.priceFrom = false,
  });

  final int id;
  final String name;
  final String? image;
  final List<String> images;
  final Price price;
  final Rating rating;
  final int stock;
  final bool inStock;
  final Ref? category;
  final Ref? subcategory;
  final Ref? vendor;
  final Sourcing sourcing;
  final bool hasBulkPricing;
  final bool hasOptions;

  /// True when `price` is the cheapest of several combinations rather than
  /// *the* price. The card says "From" so it never quotes one figure as though
  /// the choice did not change it.
  final bool priceFrom;
  final ProductBadges badges;

  /// An import is bought to order, so a zero on hand does not make it
  /// unbuyable — only local stock actually runs out.
  bool get buyable => sourcing.isLocal ? inStock : true;

  factory ProductCardModel.fromJson(Map<String, dynamic> json) => ProductCardModel(
        id: asInt(json['id']),
        name: asString(json['name']),
        image: asStringOrNull(json['image']),
        images: asStringList(json['images']),
        price: Price.fromJson(asMap(json['price'])),
        rating: Rating.fromJson(asMap(json['rating'])),
        stock: asInt(json['stock']),
        inStock: asBool(json['in_stock']),
        category: Ref.maybe(json['category']),
        subcategory: Ref.maybe(json['subcategory']),
        vendor: Ref.maybe(json['vendor']),
        sourcing: Sourcing.of(json['sourcing']),
        hasBulkPricing: asBool(json['has_bulk_pricing']),
        hasOptions: asBool(json['has_options']),
        priceFrom: asBool(json['price_from']),
        badges: json['badges'] == null
            ? ProductBadges.none
            : ProductBadges.fromJson(asMap(json['badges'])),
      );
}

/// One way to buy a product: its own row, or an imported alternative.
class BuyingOption {
  const BuyingOption({
    required this.id,
    required this.price,
    required this.stock,
    required this.inStock,
    required this.seller,
    required this.sourcing,
  });

  /// Null for the product's own primary offer.
  final int? id;
  final Price price;
  final int stock;
  final bool inStock;
  final String seller;
  final Sourcing sourcing;

  bool get buyable => sourcing.isLocal ? inStock : true;

  factory BuyingOption.fromJson(Map<String, dynamic> json) => BuyingOption(
        id: asIntOrNull(json['id']),
        price: Price.fromJson(asMap(json['price'])),
        stock: asInt(json['stock']),
        inStock: asBool(json['in_stock']),
        seller: asString(json['seller']),
        sourcing: Sourcing.of(json['sourcing']),
      );
}

/// One quantity break. `maxQuantity` null is the open-ended top tier.
class PriceTier {
  const PriceTier({
    required this.minQuantity,
    required this.unitPrice,
    required this.label,
    this.maxQuantity,
  });

  final int minQuantity;
  final int? maxQuantity;
  final double unitPrice;

  /// Pre-formatted by the server: "1–4", "1,001+".
  final String label;

  factory PriceTier.fromJson(Map<String, dynamic> json) => PriceTier(
        minQuantity: asInt(json['min_quantity']),
        maxQuantity: asIntOrNull(json['max_quantity']),
        unitPrice: asDouble(json['unit_price']),
        label: asString(json['label']),
      );

  bool covers(int quantity) =>
      quantity >= minQuantity && (maxQuantity == null || quantity <= maxQuantity!);
}

class OptionValue {
  const OptionValue({required this.id, required this.value});

  final int id;
  final String value;

  factory OptionValue.fromJson(Map<String, dynamic> json) =>
      OptionValue(id: asInt(json['id']), value: asString(json['value']));
}

/// One axis of choice — "Colour", "Size".
class OptionAxis {
  const OptionAxis({
    required this.attributeId,
    required this.name,
    required this.values,
    this.unit,
  });

  final int attributeId;
  final String name;
  final String? unit;
  final List<OptionValue> values;

  factory OptionAxis.fromJson(Map<String, dynamic> json) => OptionAxis(
        attributeId: asInt(json['attribute_id']),
        name: asString(json['name']),
        unit: asStringOrNull(json['unit']),
        values: asList(json['values'], OptionValue.fromJson),
      );
}

/// One buyable combination.
class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.price,
    required this.stock,
    required this.inStock,
    required this.options,
    this.sku,
  });

  final int id;
  final String? sku;
  final Price price;
  final int stock;
  final bool inStock;

  /// `{attribute_id: attribute_value_id}` — which value on each axis.
  final Map<int, int> options;

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    final options = <int, int>{};
    for (final entry in asMapList(json['options'])) {
      options[asInt(entry['attribute_id'])] = asInt(entry['attribute_value_id']);
    }
    return ProductVariant(
      id: asInt(json['id']),
      sku: asStringOrNull(json['sku']),
      price: Price.fromJson(asMap(json['price'])),
      stock: asInt(json['stock']),
      inStock: asBool(json['in_stock']),
      options: options,
    );
  }

  /// True when this combination matches every axis the shopper has chosen.
  bool matches(Map<int, int> selection) =>
      selection.entries.every((e) => options[e.key] == e.value);
}

/// Present only when the product sells by combination, in which case the
/// parent row's own stock and price are not the commercial unit.
class VariantSummary {
  const VariantSummary({
    required this.requiresSelection,
    required this.stock,
    required this.inStock,
    required this.priceFrom,
    required this.priceTo,
    required this.isRange,
  });

  final bool requiresSelection;
  final int stock;
  final bool inStock;
  final double priceFrom;
  final double priceTo;
  final bool isRange;

  factory VariantSummary.fromJson(Map<String, dynamic> json) => VariantSummary(
        requiresSelection: asBool(json['requires_selection']),
        stock: asInt(json['stock']),
        inStock: asBool(json['in_stock']),
        priceFrom: asDouble(json['price_from']),
        priceTo: asDouble(json['price_to']),
        isRange: asBool(json['is_range']),
      );

  static VariantSummary? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : VariantSummary.fromJson(map);
  }
}

class Specification {
  const Specification({required this.label, required this.value});

  final String label;
  final String value;

  factory Specification.fromJson(Map<String, dynamic> json) =>
      Specification(label: asString(json['label']), value: asString(json['value']));
}

class Review {
  const Review({
    required this.id,
    required this.author,
    required this.rating,
    this.comment,
    this.date,
  });

  final int id;
  final String author;
  final int rating;
  final String? comment;
  final String? date;

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        id: asInt(json['id']),
        author: asString(json['author']),
        rating: asInt(json['rating']),
        comment: asStringOrNull(json['comment']),
        date: asStringOrNull(json['date']),
      );
}

/// The seller block on a product page, with contact details already normalised
/// by the backend.
class ProductVendor {
  const ProductVendor({
    required this.id,
    required this.name,
    required this.isApproved,
    required this.isVerified,
    this.logo,
    this.phone,
    this.phoneDisplay,
    this.whatsapp,
    this.location,
    this.website,
    this.about,
    this.memberSince,
    this.userId,
  });

  final int id;
  final String name;
  final String? logo;

  /// E.164, or null when the stored number is not dialable.
  final String? phone;
  final String? phoneDisplay;

  /// Ready-made wa.me link, or null when the number cannot take WhatsApp.
  final String? whatsapp;
  final String? location;
  final String? website;
  final String? about;
  final bool isApproved;

  /// Granted only by an administrator; drives the verified checkmark.
  final bool isVerified;
  final String? memberSince;

  /// The seller's account, used to open a chat thread.
  final int? userId;

  factory ProductVendor.fromJson(Map<String, dynamic> json) => ProductVendor(
        id: asInt(json['id']),
        name: asString(json['name']),
        logo: asStringOrNull(json['logo']),
        phone: asStringOrNull(json['phone']),
        phoneDisplay: asStringOrNull(json['phone_display']),
        whatsapp: asStringOrNull(json['whatsapp']),
        location: asStringOrNull(json['location']),
        website: asStringOrNull(json['website']),
        about: asStringOrNull(json['about']),
        isApproved: asBool(json['is_approved']),
        isVerified: asBool(json['is_verified']),
        memberSince: asStringOrNull(json['member_since']),
        userId: asIntOrNull(json['user_id']),
      );

  static ProductVendor? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : ProductVendor.fromJson(map);
  }
}

class ProductDetail {
  const ProductDetail({
    required this.id,
    required this.name,
    required this.price,
    required this.stock,
    required this.inStock,
    required this.sourcing,
    required this.buyingOptions,
    required this.priceTiers,
    required this.options,
    required this.variants,
    required this.specifications,
    required this.rating,
    required this.reviews,
    this.shortDescription,
    this.description,
    this.image,
    this.images = const [],
    this.category,
    this.subcategory,
    this.vendor,
    this.variantSummary,
  });

  final int id;
  final String name;
  final String? shortDescription;
  final String? description;
  final String? image;
  final List<String> images;
  final Price price;
  final int stock;
  final bool inStock;
  final Ref? category;
  final Ref? subcategory;
  final ProductVendor? vendor;
  final Sourcing sourcing;

  /// Primary offer first; more than one turns the page into a comparison.
  final List<BuyingOption> buyingOptions;
  final List<PriceTier> priceTiers;
  final List<OptionAxis> options;
  final List<ProductVariant> variants;
  final VariantSummary? variantSummary;
  final List<Specification> specifications;
  final DetailedRating rating;
  final List<Review> reviews;

  bool get hasVariants => variantSummary != null && options.isNotEmpty;

  /// Every photo worth showing, primary first and without duplicates.
  List<String> get gallery {
    final out = <String>[];
    if (image != null && image!.isNotEmpty) out.add(image!);
    for (final url in images) {
      if (!out.contains(url)) out.add(url);
    }
    return out;
  }

  factory ProductDetail.fromJson(Map<String, dynamic> json) => ProductDetail(
        id: asInt(json['id']),
        name: asString(json['name']),
        shortDescription: asStringOrNull(json['short_description']),
        description: asStringOrNull(json['description']),
        image: asStringOrNull(json['image']),
        images: asStringList(json['images']),
        price: Price.fromJson(asMap(json['price'])),
        stock: asInt(json['stock']),
        inStock: asBool(json['in_stock']),
        category: Ref.maybe(json['category']),
        subcategory: Ref.maybe(json['subcategory']),
        vendor: ProductVendor.maybe(json['vendor']),
        sourcing: Sourcing.of(json['sourcing']),
        buyingOptions: asList(json['buying_options'], BuyingOption.fromJson),
        priceTiers: asList(json['price_tiers'], PriceTier.fromJson),
        options: asList(json['options'], OptionAxis.fromJson),
        variants: asList(json['variants'], ProductVariant.fromJson),
        variantSummary: VariantSummary.maybe(json['variant_summary']),
        specifications: asList(json['specifications'], Specification.fromJson),
        rating: json['rating'] == null
            ? DetailedRating.none
            : DetailedRating.fromJson(asMap(json['rating'])),
        reviews: asList(json['reviews'], Review.fromJson),
      );

  /// A card built from this detail, so the cart and wishlist can hold a
  /// product opened directly from a deep link.
  ProductCardModel toCard() => ProductCardModel(
        id: id,
        name: name,
        image: image,
        images: images,
        price: price,
        rating: rating.rating,
        stock: stock,
        inStock: inStock,
        category: category,
        subcategory: subcategory,
        vendor: vendor == null
            ? null
            : Ref(id: vendor!.id, name: vendor!.name, isVerified: vendor!.isVerified),
        sourcing: sourcing,
        hasBulkPricing: priceTiers.isNotEmpty,
        hasOptions: options.isNotEmpty,
        badges: ProductBadges(
          lowStock: sourcing.isLocal && inStock && stock > 0 && stock <= 5,
          outOfStock: sourcing.isLocal && !inStock,
          discounted: price.isDiscounted,
        ),
      );
}

/// A product page's full payload.
class ProductPage {
  const ProductPage({
    required this.product,
    required this.related,
    required this.fromVendor,
  });

  final ProductDetail product;
  final List<ProductCardModel> related;
  final List<ProductCardModel> fromVendor;

  factory ProductPage.fromJson(Map<String, dynamic> json) => ProductPage(
        product: ProductDetail.fromJson(asMap(json['product'])),
        related: asList(json['related'], ProductCardModel.fromJson),
        fromVendor: asList(json['from_vendor'], ProductCardModel.fromJson),
      );
}
