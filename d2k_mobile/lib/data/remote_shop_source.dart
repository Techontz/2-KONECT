import '../domain/models/commerce.dart';
import 'api_client.dart';

/// Addresses, orders and checkout, mapped from the same `/shop/*` endpoints
/// the website uses. Nothing here invents an order, a price or a status: the
/// backend owns all of that and the app only renders what it returns.
class RemoteShopSource {
  RemoteShopSource(this._api);

  final ApiClient _api;

  /* ---------------------------------------------------------------- */
  /* addresses                                                        */
  /* ---------------------------------------------------------------- */

  Future<List<Address>> addresses() async {
    final body = await _api.get('/shop/addresses');
    return [
      for (final raw in (body['addresses'] as List? ?? const []))
        _address(raw as Map<String, dynamic>),
    ];
  }

  Future<Address> createAddress(AddressDraft draft) async {
    final body = await _api.post('/shop/addresses', draft.toJson());
    return _address(body['address'] as Map<String, dynamic>);
  }

  Future<Address> updateAddress(String id, AddressDraft draft) async {
    final body = await _api.put('/shop/addresses/$id', draft.toJson());
    return _address(body['address'] as Map<String, dynamic>);
  }

  Future<void> deleteAddress(String id) => _api.delete('/shop/addresses/$id');

  Future<void> makeDefaultAddress(String id) =>
      _api.post('/shop/addresses/$id/default');

  Address _address(Map<String, dynamic> json) {
    String? clean(Object? v) {
      final t = v?.toString().trim() ?? '';
      return t.isEmpty || t == 'null' ? null : t;
    }

    return Address(
      id: '${json['id']}',
      // The backend has no free-text label; the district is the closest
      // human-recognisable name for a saved place.
      label: clean(json['district']) ?? clean(json['city']) ?? 'Address',
      line1: clean(json['street']) ?? clean(json['details']) ?? '',
      district: clean(json['district']) ?? '',
      city: clean(json['city']) ?? '',
      country: clean(json['region']) ?? 'Tanzania',
      isDefault: json['is_default'] == true,
      fullName: clean(json['full_name']),
      phone: clean(json['phone']),
      details: clean(json['details']),
      formatted: clean(json['formatted']),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
    );
  }

  /* ---------------------------------------------------------------- */
  /* orders                                                           */
  /* ---------------------------------------------------------------- */

  Future<List<ShopOrder>> orders() async {
    final body = await _api.get('/shop/orders');
    return [
      for (final raw in (body['orders'] as List? ?? const []))
        _order(raw as Map<String, dynamic>),
    ];
  }

  Future<ShopOrder> order(String reference) async {
    final body = await _api.get('/shop/orders/$reference');
    return _order(body['order'] as Map<String, dynamic>);
  }

  /// Places the order. The server prices every line, checks stock and decides
  /// the total — the app sends product ids and quantities only.
  Future<ShopOrder> placeOrder({
    required List<OrderLineRequest> items,
    required String deliveryAddress,
    required String customerPhone,
    String paymentMethod = 'cash_on_delivery',
  }) async {
    final body = await _api.post('/shop/orders', {
      'items': [
        for (final item in items)
          {'product_id': int.tryParse(item.productId) ?? item.productId, 'quantity': item.quantity},
      ],
      'delivery_address': deliveryAddress,
      'customer_phone': customerPhone,
      'payment_method': paymentMethod,
    });

    return _order(body['order'] as Map<String, dynamic>);
  }

  Future<void> cancelOrder(String reference) =>
      _api.post('/shop/orders/$reference/cancel');

  ShopOrder _order(Map<String, dynamic> json) => ShopOrder(
        reference: '${json['reference']}',
        status: '${json['status'] ?? 'pending'}',
        placedAt: DateTime.tryParse('${json['placed_at']}') ?? DateTime.now(),
        itemCount: (json['item_count'] as num?)?.toInt() ?? 0,
        subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0,
        deliveryFee: (json['delivery_fee'] as num?)?.toDouble() ?? 0,
        total: (json['total'] as num?)?.toDouble() ?? 0,
        paymentMethod: '${json['payment_method'] ?? ''}',
        deliveryAddress: '${json['delivery_address'] ?? ''}',
        customerPhone: '${json['customer_phone'] ?? ''}',
        items: [
          for (final raw in (json['items'] as List? ?? const []))
            _orderItem(raw as Map<String, dynamic>),
        ],
      );

  ShopOrderItem _orderItem(Map<String, dynamic> json) {
    final product = json['product'] as Map?;
    return ShopOrderItem(
      id: '${json['id']}',
      productId: product == null ? null : '${product['id']}',
      name: '${product?['name'] ?? 'Item no longer available'}',
      image: '${product?['image'] ?? ''}',
      vendorName: json['vendor'] == null ? null : '${json['vendor']}',
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      price: (json['price'] as num?)?.toDouble() ?? 0,
      total: (json['total'] as num?)?.toDouble() ?? 0,
      status: '${json['status'] ?? ''}',
    );
  }
}

class OrderLineRequest {
  const OrderLineRequest({required this.productId, required this.quantity});

  final String productId;
  final int quantity;
}

/// What the app sends when saving an address.
class AddressDraft {
  const AddressDraft({
    required this.fullName,
    required this.phone,
    required this.city,
    this.region,
    this.district,
    this.street,
    this.details,
    this.latitude,
    this.longitude,
    this.isDefault = false,
  });

  final String fullName;
  final String phone;
  final String city;
  final String? region;
  final String? district;
  final String? street;
  final String? details;
  final double? latitude;
  final double? longitude;
  final bool isDefault;

  Map<String, dynamic> toJson() => {
        'full_name': fullName,
        'phone': phone,
        'city': city,
        if (region != null && region!.isNotEmpty) 'region': region,
        if (district != null && district!.isNotEmpty) 'district': district,
        if (street != null && street!.isNotEmpty) 'street': street,
        if (details != null && details!.isNotEmpty) 'details': details,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        'is_default': isDefault,
      };
}
