import 'common.dart';
import 'json.dart';
import 'product.dart';

/// One line the shopper is holding.
///
/// The basket lives on the device, so it can remember *what* was picked up but
/// must never be believed about *what it costs* — every figure shown at
/// checkout comes back from `/shop/cart/quote`.
class CartLine {
  const CartLine({
    required this.product,
    required this.quantity,
    this.option,
    this.variantId,
    this.variantLabel,
  });

  final ProductCardModel product;
  final int quantity;

  /// Which buying option was chosen, when the shopper picked the imported
  /// alternative rather than the product's own offer. Null means the primary
  /// offer, which is every line placed before options existed.
  final BuyingOption? option;
  final int? variantId;

  /// The combination in the words it was chosen under — "Colour: Black".
  final String? variantLabel;

  int? get offerId => option?.id;

  /// Where *this line* is sourced from. An imported buying option overrides
  /// the product's own sourcing, which is the entire point of offers.
  Sourcing get sourcing => option?.sourcing ?? product.sourcing;

  bool get isImport => sourcing.isImport;

  /// Stable identity: the same product bought two different ways is two lines.
  String get key => '${product.id}:${option?.id ?? 'own'}:${variantId ?? 'base'}';

  CartLine copyWith({int? quantity}) => CartLine(
        product: product,
        quantity: quantity ?? this.quantity,
        option: option,
        variantId: variantId,
        variantLabel: variantLabel,
      );

  Map<String, dynamic> toOrderItem() => {
        'product_id': product.id,
        'quantity': quantity,
        if (option?.id != null) 'offer_id': option!.id,
        if (variantId != null) 'variant_id': variantId,
      };

  Map<String, dynamic> toJson() => {
        'product': {
          'id': product.id,
          'name': product.name,
          'image': product.image,
          'price': {
            'currency': product.price.currency,
            'current': product.price.current,
            'was': product.price.was,
            'discount_percent': product.price.discountPercent,
          },
          'stock': product.stock,
          'in_stock': product.inStock,
          'rating': {'average': product.rating.average, 'count': product.rating.count},
          'sourcing': _sourcingJson(product.sourcing),
          'vendor': product.vendor == null
              ? null
              : {'id': product.vendor!.id, 'name': product.vendor!.name},
          'badges': {
            'low_stock': product.badges.lowStock,
            'out_of_stock': product.badges.outOfStock,
            'discounted': product.badges.discounted,
          },
        },
        'quantity': quantity,
        'variant_id': variantId,
        'variant_label': variantLabel,
        'option': option == null
            ? null
            : {
                'id': option!.id,
                'price': {
                  'currency': option!.price.currency,
                  'current': option!.price.current,
                  'was': option!.price.was,
                  'discount_percent': option!.price.discountPercent,
                },
                'stock': option!.stock,
                'in_stock': option!.inStock,
                'seller': option!.seller,
                'sourcing': _sourcingJson(option!.sourcing),
              },
      };

  static Map<String, dynamic> _sourcingJson(Sourcing s) => {
        'type': s.type.wire,
        'is_local': s.isLocal,
        'label': s.label,
        'headline': s.headline,
        'summary': s.summary,
        'lead_time': {'min': s.leadTime.min, 'max': s.leadTime.max, 'label': s.leadTime.label},
        'origin': s.origin == null
            ? null
            : {'code': s.origin!.code, 'name': s.origin!.name, 'flag': s.origin!.flag},
        'destination': s.destination == null
            ? null
            : {
                'code': s.destination!.code,
                'name': s.destination!.name,
                'flag': s.destination!.flag
              },
        'fulfilment_location': s.fulfilmentLocation,
      };

  factory CartLine.fromJson(Map<String, dynamic> json) => CartLine(
        product: ProductCardModel.fromJson(asMap(json['product'])),
        quantity: asInt(json['quantity'], 1),
        variantId: asIntOrNull(json['variant_id']),
        variantLabel: asStringOrNull(json['variant_label']),
        option: json['option'] == null ? null : BuyingOption.fromJson(asMap(json['option'])),
      );
}

/// A server-priced basket line. The device never does this arithmetic.
class QuoteLine {
  const QuoteLine({
    required this.productId,
    required this.quantity,
    required this.unitPrice,
    required this.basePrice,
    required this.total,
    required this.stock,
    required this.purchasable,
    this.offerId,
    this.variantId,
    this.tier,
    this.reason,
  });

  final int productId;
  final int? offerId;
  final int? variantId;
  final int quantity;
  final Price unitPrice;
  final Price basePrice;
  final Price total;
  final PriceTier? tier;
  final int stock;
  final bool purchasable;

  /// Why not, when `purchasable` is false — already in the customer's words.
  final String? reason;

  String get key => '$productId:${offerId ?? 'own'}:${variantId ?? 'base'}';

  factory QuoteLine.fromJson(Map<String, dynamic> json) => QuoteLine(
        productId: asInt(json['product_id']),
        offerId: asIntOrNull(json['offer_id']),
        variantId: asIntOrNull(json['variant_id']),
        quantity: asInt(json['quantity']),
        unitPrice: Price.fromJson(asMap(json['unit_price'])),
        basePrice: Price.fromJson(asMap(json['base_price'])),
        total: Price.fromJson(asMap(json['total'])),
        tier: json['tier'] == null ? null : PriceTier.fromJson(asMap(json['tier'])),
        stock: asInt(json['stock']),
        purchasable: asBool(json['purchasable'], true),
        reason: asStringOrNull(json['reason']),
      );
}

class CartQuote {
  const CartQuote({
    required this.lines,
    required this.subtotal,
    required this.canCheckout,
  });

  final List<QuoteLine> lines;
  final Price subtotal;
  final bool canCheckout;

  QuoteLine? lineFor(CartLine line) {
    for (final quoted in lines) {
      if (quoted.key == line.key) return quoted;
    }
    return null;
  }

  factory CartQuote.fromJson(Map<String, dynamic> json) => CartQuote(
        lines: asList(json['lines'], QuoteLine.fromJson),
        subtotal: Price.fromJson(asMap(json['subtotal'])),
        canCheckout: asBool(json['can_checkout']),
      );

  static const empty = CartQuote(lines: [], subtotal: Price.zero, canCheckout: false);
}
