import 'common.dart';
import 'json.dart';
import 'payment.dart';

class OrderItemOption {
  const OrderItemOption({required this.attribute, required this.value});

  final String attribute;
  final String value;

  factory OrderItemOption.fromJson(Map<String, dynamic> json) => OrderItemOption(
        attribute: asString(json['attribute']),
        value: asString(json['value']),
      );
}

class OrderItem {
  const OrderItem({
    required this.id,
    required this.quantity,
    required this.price,
    required this.total,
    required this.status,
    required this.sourcing,
    this.productId,
    this.productName,
    this.productImage,
    this.vendor,
    this.options = const [],
  });

  final int id;
  final int? productId;
  final String? productName;
  final String? productImage;
  final String? vendor;
  final int quantity;
  final double price;
  final double total;
  final String status;
  final Sourcing sourcing;

  /// The combination bought, in the words it was bought under — frozen onto
  /// the order at checkout rather than looked up against today's listing.
  final List<OrderItemOption> options;

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    final product = asMapOrNull(json['product']);
    return OrderItem(
      id: asInt(json['id']),
      productId: product == null ? null : asIntOrNull(product['id']),
      productName: product == null ? null : asStringOrNull(product['name']),
      productImage: product == null ? null : asStringOrNull(product['image']),
      vendor: asStringOrNull(json['vendor']),
      quantity: asInt(json['quantity'], 1),
      price: asDouble(json['price']),
      total: asDouble(json['total']),
      status: asString(json['status']),
      sourcing: Sourcing.of(json['sourcing']),
      options: asList(json['options'], OrderItemOption.fromJson),
    );
  }
}

/// One stop on the order journey, as the tracking screen renders it.
class TimelineStep {
  const TimelineStep({
    required this.status,
    required this.title,
    required this.icon,
    required this.state,
    this.note,
    this.location,
    this.happenedAt,
  });

  final String status;
  final String title;
  final String? note;

  /// A name the app maps to a glyph — receipt, plane, truck, check…
  final String icon;

  /// `done` | `current` | `upcoming`.
  final String state;
  final String? location;
  final DateTime? happenedAt;

  bool get isDone => state == 'done';
  bool get isCurrent => state == 'current';

  factory TimelineStep.fromJson(Map<String, dynamic> json) => TimelineStep(
        status: asString(json['status']),
        title: asString(json['title']),
        note: asStringOrNull(json['note']),
        icon: asString(json['icon']),
        state: asString(json['state'], 'upcoming'),
        location: asStringOrNull(json['location']),
        happenedAt: asDate(json['happened_at']),
      );
}

class OrderFulfilment {
  const OrderFulfilment({
    required this.type,
    required this.label,
    this.origin,
    this.destination,
    this.eta,
    this.estimatedArrivalAt,
    this.trackingNumber,
    this.carrier,
    this.shippingMethod,
  });

  final Availability type;
  final String label;
  final Country? origin;
  final Country? destination;
  final LeadTime? eta;
  final DateTime? estimatedArrivalAt;
  final String? trackingNumber;
  final String? carrier;
  final String? shippingMethod;

  bool get isImport => type == Availability.import;

  factory OrderFulfilment.fromJson(Map<String, dynamic> json) => OrderFulfilment(
        type: Availability.parse(json['type']),
        label: asString(json['label']),
        origin: Country.maybe(json['origin']),
        destination: Country.maybe(json['destination']),
        eta: LeadTime.maybe(json['eta']),
        estimatedArrivalAt: asDate(json['estimated_arrival_at']),
        trackingNumber: asStringOrNull(json['tracking_number']),
        carrier: asStringOrNull(json['carrier']),
        shippingMethod: asStringOrNull(json['shipping_method']),
      );

  static const local = OrderFulfilment(type: Availability.local, label: 'In Tanzania');
}

enum DeliveryMode {
  delivery,
  pickup;

  static DeliveryMode parse(Object? value) =>
      asString(value) == 'pickup' ? DeliveryMode.pickup : DeliveryMode.delivery;

  String get wire => name;
}

/// A last-mile job attached to an order — 2KONECT Rides.
///
/// Deliberately its own record with its own status. Delivery is arranged after
/// the goods land; it is not the order and it is not the payment.
class DeliveryRequest {
  const DeliveryRequest({
    required this.reference,
    required this.mode,
    required this.status,
    required this.statusLabel,
    required this.recipientName,
    required this.recipientPhone,
    required this.fee,
    this.orderReference,
    this.address,
    this.pickupPoint,
    this.preferredDate,
    this.preferredWindow,
    this.courierName,
    this.courierPhone,
    this.createdAt,
  });

  final String reference;
  final String? orderReference;
  final DeliveryMode mode;
  final String status;
  final String statusLabel;
  final String recipientName;
  final String recipientPhone;
  final String? address;
  final String? pickupPoint;
  final String? preferredDate;
  final String? preferredWindow;
  final double fee;
  final String? courierName;
  final String? courierPhone;
  final DateTime? createdAt;

  factory DeliveryRequest.fromJson(Map<String, dynamic> json) => DeliveryRequest(
        reference: asString(json['reference']),
        orderReference: asStringOrNull(json['order_reference']),
        mode: DeliveryMode.parse(json['mode']),
        status: asString(json['status']),
        statusLabel: asString(json['status_label']),
        recipientName: asString(json['recipient_name']),
        recipientPhone: asString(json['recipient_phone']),
        address: asStringOrNull(json['address']),
        pickupPoint: asStringOrNull(json['pickup_point']),
        preferredDate: asStringOrNull(json['preferred_date']),
        preferredWindow: asStringOrNull(json['preferred_window']),
        fee: asDouble(json['fee']),
        courierName: asStringOrNull(json['courier_name']),
        courierPhone: asStringOrNull(json['courier_phone']),
        createdAt: asDate(json['created_at']),
      );

  static DeliveryRequest? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : DeliveryRequest.fromJson(map);
  }
}

class DeliveryModeOption {
  const DeliveryModeOption({
    required this.value,
    required this.label,
    required this.note,
    required this.fee,
  });

  final DeliveryMode value;
  final String label;
  final String note;
  final double fee;

  factory DeliveryModeOption.fromJson(Map<String, dynamic> json) => DeliveryModeOption(
        value: DeliveryMode.parse(json['value']),
        label: asString(json['label']),
        note: asString(json['note']),
        fee: asDouble(json['fee']),
      );
}

class PickupPoint {
  const PickupPoint({required this.id, required this.name, required this.address});

  final String id;
  final String name;
  final String address;

  factory PickupPoint.fromJson(Map<String, dynamic> json) => PickupPoint(
        id: asString(json['id']),
        name: asString(json['name']),
        address: asString(json['address']),
      );
}

class DeliveryOptions {
  const DeliveryOptions({
    required this.available,
    required this.modes,
    required this.pickupPoints,
    required this.windows,
  });

  final bool available;
  final List<DeliveryModeOption> modes;
  final List<PickupPoint> pickupPoints;
  final List<String> windows;

  factory DeliveryOptions.fromJson(Map<String, dynamic> json) => DeliveryOptions(
        available: asBool(json['available']),
        modes: asList(json['modes'], DeliveryModeOption.fromJson),
        pickupPoints: asList(json['pickup_points'], PickupPoint.fromJson),
        windows: asStringList(json['windows']),
      );

  static const none =
      DeliveryOptions(available: false, modes: [], pickupPoints: [], windows: []);
}

class Order {
  const Order({
    required this.reference,
    required this.status,
    required this.statusLabel,
    required this.fulfilment,
    required this.timeline,
    required this.canCancel,
    required this.canRequestDelivery,
    required this.itemCount,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.currency,
    required this.paymentStatus,
    required this.items,
    this.deliveryRequest,
    this.placedAt,
    this.paymentMethod,
    this.paymentReference,
    this.paymentNote,
    this.deliveryAddress,
    this.customerPhone,
  });

  final String reference;

  /// The order's own progress. Not the payment, not the delivery.
  final String status;
  final String statusLabel;
  final OrderFulfilment fulfilment;
  final List<TimelineStep> timeline;
  final bool canCancel;
  final bool canRequestDelivery;
  final DeliveryRequest? deliveryRequest;
  final DateTime? placedAt;
  final int itemCount;
  final double subtotal;
  final double deliveryFee;
  final double total;
  final String currency;
  final String? paymentMethod;

  /// Whether the money arrived, as opposed to which method was chosen.
  final PaymentStatus paymentStatus;
  final String? paymentReference;
  final String? paymentNote;
  final String? deliveryAddress;
  final String? customerPhone;
  final List<OrderItem> items;

  bool get isImport => fulfilment.isImport;

  /// True while 2KONECT is waiting for this customer to send money.
  bool get awaitsPayment => paymentStatus.needsPayment;

  /// Delivery has not been arranged yet — which is the normal state of a
  /// landed import, not an error.
  bool get deliveryNotArranged => deliveryRequest == null;

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        reference: asString(json['reference']),
        status: asString(json['status']),
        statusLabel: asString(json['status_label']),
        fulfilment: json['fulfilment'] == null
            ? OrderFulfilment.local
            : OrderFulfilment.fromJson(asMap(json['fulfilment'])),
        timeline: asList(json['timeline'], TimelineStep.fromJson),
        canCancel: asBool(json['can_cancel']),
        canRequestDelivery: asBool(json['can_request_delivery']),
        deliveryRequest: DeliveryRequest.maybe(json['delivery_request']),
        placedAt: asDate(json['placed_at']),
        itemCount: asInt(json['item_count']),
        subtotal: asDouble(json['subtotal']),
        deliveryFee: asDouble(json['delivery_fee']),
        total: asDouble(json['total']),
        currency: asString(json['currency'], 'TZS'),
        paymentMethod: asStringOrNull(json['payment_method']),
        paymentStatus: PaymentStatus.parse(json['payment_status']),
        paymentReference: asStringOrNull(json['payment_reference']),
        paymentNote: asStringOrNull(json['payment_note']),
        deliveryAddress: asStringOrNull(json['delivery_address']),
        customerPhone: asStringOrNull(json['customer_phone']),
        items: asList(json['items'], OrderItem.fromJson),
      );
}
