import 'currency.dart';
import 'product.dart';

class CartItem {
  const CartItem({
    required this.product,
    required this.quantity,
    this.variantLabel,
  });

  final Product product;
  final int quantity;
  final String? variantLabel;

  String get key => variantLabel == null
      ? product.id
      : '${product.id}::$variantLabel';

  Money get lineTotal => product.price * quantity;

  Money get lineSavings => product.hasDiscount
      ? Money((product.originalPriceBase! - product.priceBase) * quantity)
      : Money.zero;

  CartItem copyWith({int? quantity}) => CartItem(
        product: product,
        quantity: quantity ?? this.quantity,
        variantLabel: variantLabel,
      );
}

/// A delivery address, as stored by the backend.
///
/// The same `addresses` table the website writes to — there is no separate
/// mobile address book.
class Address {
  const Address({
    required this.id,
    required this.label,
    required this.line1,
    required this.district,
    required this.city,
    required this.country,
    this.isDefault = false,
    this.fullName,
    this.phone,
    this.details,
    this.formatted,
    this.latitude,
    this.longitude,
  });

  final String id;
  final String label;
  final String line1;
  final String district;
  final String city;
  final String country;
  final bool isDefault;

  /// Recipient details — who the courier asks for and calls.
  final String? fullName;
  final String? phone;
  final String? details;

  /// The backend's own one-line rendering; preferred over rebuilding it here
  /// so the app and the website describe a place identically.
  final String? formatted;

  final double? latitude;
  final double? longitude;

  bool get hasPin => latitude != null && longitude != null;

  String get summary {
    final own = formatted?.trim();
    if (own != null && own.isNotEmpty) return own;
    return [line1, district, city]
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .join(' · ');
  }
}

/// An order exactly as the backend reports it.
///
/// Prices, totals and statuses are server-side facts; nothing here is
/// recalculated on the device.
class ShopOrder {
  const ShopOrder({
    required this.reference,
    required this.status,
    required this.placedAt,
    required this.itemCount,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.paymentMethod,
    required this.deliveryAddress,
    required this.customerPhone,
    required this.items,
  });

  final String reference;
  final String status;
  final DateTime placedAt;
  final int itemCount;
  final double subtotal;
  final double deliveryFee;
  final double total;
  final String paymentMethod;
  final String deliveryAddress;
  final String customerPhone;
  final List<ShopOrderItem> items;

  Money get totalMoney => Money(total);
  Money get subtotalMoney => Money(subtotal);
  Money get deliveryMoney => Money(deliveryFee);

  bool get isCancelled => status == 'cancelled';
  bool get isComplete => status == 'completed';

  /// Only an order nothing has shipped for can still be called off.
  bool get canCancel => status == 'pending' || status == 'processing';

  String get paymentLabel => switch (paymentMethod) {
        'cash_on_delivery' => 'Cash on delivery',
        'mobile_money' => 'Mobile money',
        _ => paymentMethod.replaceAll('_', ' '),
      };
}

class ShopOrderItem {
  const ShopOrderItem({
    required this.id,
    required this.name,
    required this.quantity,
    required this.price,
    required this.total,
    required this.status,
    this.productId,
    this.image = '',
    this.vendorName,
  });

  final String id;

  /// Null when the product row has since been removed — the line still shows,
  /// because the order really happened.
  final String? productId;
  final String name;
  final String image;
  final String? vendorName;
  final int quantity;
  final double price;
  final double total;
  final String status;

  Money get lineTotal => Money(total);
  Money get unitPrice => Money(price);
}

enum OrderStatus { placed, packed, shipped, delivered }

class Order {
  const Order({
    required this.id,
    required this.placedAt,
    required this.items,
    required this.totalBase,
    required this.status,
    required this.deliveryAddress,
  });

  final String id;
  final DateTime placedAt;
  final List<CartItem> items;
  final double totalBase;
  final OrderStatus status;
  final String deliveryAddress;

  Money get total => Money(totalBase);
  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);
}

class AppUser {
  const AppUser({
    required this.name,
    required this.phone,
    this.email,
  });

  final String name;
  final String phone;
  final String? email;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return 'D';
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }
}

extension on String {
  Iterable<String> get characters => split('');
}
