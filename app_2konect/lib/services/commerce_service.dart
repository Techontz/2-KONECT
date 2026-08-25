import '../core/network/api_client.dart';
import '../models/cart.dart';
import '../models/json.dart';
import '../models/order.dart';
import '../models/payment.dart';

/// Pricing a basket, placing an order, and paying for it.
///
/// Nothing here decides a rule. Every rule the checkout obeys — whether cash
/// on delivery is offered, whether a delivery fee applies, whether a payment
/// counts as received — is decided by `App\Support\CheckoutPolicy` on the
/// server and merely reported to this app.
class CommerceService {
  const CommerceService(this._api);

  final ApiClient _api;

  /// Prices a basket on the server.
  ///
  /// The cart lives on the device, so it can remember what was picked up but
  /// must not be believed about what it costs — quantity tiers and variant
  /// prices are resolved by the same code that will charge for them.
  Future<CartQuote> quote(List<CartLine> lines) async {
    if (lines.isEmpty) return CartQuote.empty;
    final data = await _api.post<Map<String, dynamic>>(
      '/shop/cart/quote',
      body: {'items': lines.map((line) => line.toOrderItem()).toList()},
    );
    return CartQuote.fromJson(data);
  }

  /// What this basket may be paid with.
  ///
  /// `hasImport` is a hint so the screen can render the right thing
  /// immediately; it is not a permission. The same rule is applied again on
  /// the server against the real products when the order is placed, so a
  /// client that lies about it gets a refusal rather than cash on delivery.
  Future<PaymentOptions> paymentOptions({required bool hasImport}) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/shop/payment-channels',
      query: hasImport ? {'import': true} : null,
    );
    return PaymentOptions.fromJson(data);
  }

  Future<List<Order>> orders() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/orders');
    return asList(data['orders'], Order.fromJson);
  }

  Future<Order> order(String reference) async {
    final data = await _api.get<Map<String, dynamic>>('/shop/orders/${Uri.encodeComponent(reference)}');
    return Order.fromJson(asMap(data['order']));
  }

  Future<Order> placeOrder({
    required List<CartLine> lines,
    required String deliveryAddress,
    required String customerPhone,
    required String paymentMethod,
    String? paymentProvider,
    String? paymentReference,
  }) async {
    final data = await _api.post<Map<String, dynamic>>('/shop/orders', body: {
      'items': lines.map((line) => line.toOrderItem()).toList(),
      'delivery_address': deliveryAddress,
      'customer_phone': customerPhone,
      'payment_method': paymentMethod,
      if (paymentProvider != null && paymentProvider.isNotEmpty)
        'payment_provider': paymentProvider,
      if (paymentReference != null && paymentReference.isNotEmpty)
        'payment_reference': paymentReference,
    });
    return Order.fromJson(asMap(data['order']));
  }

  Future<void> cancelOrder(String reference) =>
      _api.post<dynamic>('/shop/orders/${Uri.encodeComponent(reference)}/cancel');

  /// Open a hosted card payment for an order that already exists.
  ///
  /// Returns only a URL. The app never sees an amount, a key or a session
  /// object, and could not usefully send one: the server prices the order from
  /// its own rows and ignores the request body entirely.
  ///
  /// Returning from the payment page settles nothing. The order is refetched
  /// and shows whatever a signed webhook has actually recorded.
  Future<String> createCheckoutSession(String reference) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/shop/orders/${Uri.encodeComponent(reference)}/checkout-session',
    );
    return asString(data['url']);
  }

  /// Tell 2KONECT the money has been sent.
  ///
  /// This never marks anything paid. It moves the order to
  /// `awaiting_verification`, which is a queue, not a state of settlement —
  /// an administrator confirms it from the admin panel, and there is no
  /// customer-reachable route that can do so.
  Future<void> submitPaymentReference(String reference, String paymentReference) =>
      _api.post<dynamic>(
        '/shop/orders/${Uri.encodeComponent(reference)}/payment',
        body: {'payment_reference': paymentReference},
      );

  /* ---- 2KONECT Rides: the last mile, arranged separately ---- */

  Future<DeliveryOptions> deliveryOptions(String reference) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/shop/orders/${Uri.encodeComponent(reference)}/delivery-options',
    );
    return DeliveryOptions.fromJson(data);
  }

  Future<List<DeliveryRequest>> deliveries() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/deliveries');
    return asList(data['requests'], DeliveryRequest.fromJson);
  }

  Future<DeliveryRequest> requestDelivery({
    required String orderReference,
    required DeliveryMode mode,
    required String recipientName,
    required String recipientPhone,
    String? address,
    String? city,
    double? latitude,
    double? longitude,
    String? pickupPoint,
    String? preferredDate,
    String? preferredWindow,
    String? notes,
  }) async {
    final data = await _api.post<Map<String, dynamic>>('/shop/deliveries', body: {
      'order_reference': orderReference,
      'mode': mode.wire,
      'recipient_name': recipientName,
      'recipient_phone': recipientPhone,
      if (address != null && address.isNotEmpty) 'address': address,
      if (city != null && city.isNotEmpty) 'city': city,
      'latitude': ?latitude,
      'longitude': ?longitude,
      if (pickupPoint != null && pickupPoint.isNotEmpty) 'pickup_point': pickupPoint,
      if (preferredDate != null && preferredDate.isNotEmpty) 'preferred_date': preferredDate,
      if (preferredWindow != null && preferredWindow.isNotEmpty)
        'preferred_window': preferredWindow,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
    return DeliveryRequest.fromJson(asMap(data['request']));
  }

  Future<void> cancelDelivery(String reference) =>
      _api.post<dynamic>('/shop/deliveries/${Uri.encodeComponent(reference)}/cancel');
}
