import 'json.dart';
import 'product.dart';

class SellerStore {
  const SellerStore({
    required this.id,
    required this.name,
    this.logo,
    this.phone,
    this.address,
    this.about,
    this.website,
    this.email,
    this.memberSince,
  });

  final int id;
  final String name;
  final String? logo;
  final String? phone;
  final String? address;
  final String? about;
  final String? website;
  final String? email;
  final String? memberSince;

  factory SellerStore.fromJson(Map<String, dynamic> json) => SellerStore(
        id: asInt(json['id']),
        name: asString(json['name']),
        logo: asStringOrNull(json['logo']),
        phone: asStringOrNull(json['phone']),
        address: asStringOrNull(json['address']),
        about: asStringOrNull(json['about']),
        website: asStringOrNull(json['website']),
        email: asStringOrNull(json['email']),
        memberSince: asStringOrNull(json['member_since']),
      );
}

/// Level 1 — may this seller publish at all?
class SellerStanding {
  const SellerStanding({
    required this.status,
    required this.canPublish,
    this.approvedAt,
    this.note,
  });

  final String status;
  final bool canPublish;
  final String? approvedAt;
  final String? note;

  factory SellerStanding.fromJson(Map<String, dynamic> json) => SellerStanding(
        status: asString(json['status'], 'pending'),
        canPublish: asBool(json['can_publish']),
        approvedAt: asStringOrNull(json['approved_at']),
        note: asStringOrNull(json['note']),
      );
}

/// One item on the verification checklist.
class VerificationRequirement {
  const VerificationRequirement({
    required this.id,
    required this.name,
    required this.required,
    required this.submitted,
    this.description,
    this.type,
    this.status,
    this.value,
    this.file,
    this.note,
  });

  final int id;
  final String name;
  final String? description;
  final String? type;
  final bool required;
  final bool submitted;
  final String? status;
  final String? value;
  final String? file;
  final String? note;

  factory VerificationRequirement.fromJson(Map<String, dynamic> json) => VerificationRequirement(
        id: asInt(json['id']),
        name: asString(json['name']),
        description: asStringOrNull(json['description']),
        type: asStringOrNull(json['type']),
        required: asBool(json['required']),
        submitted: asBool(json['submitted']),
        status: asStringOrNull(json['status']),
        value: asStringOrNull(json['value']),
        file: asStringOrNull(json['file']),
        note: asStringOrNull(json['note']),
      );
}

/// Level 2 — does this seller carry the checkmark?
class SellerVerification {
  const SellerVerification({
    required this.status,
    required this.isVerified,
    required this.canApply,
    required this.requirements,
    this.submittedAt,
    this.verifiedAt,
    this.note,
  });

  final String status;
  final bool isVerified;
  final bool canApply;
  final String? submittedAt;
  final String? verifiedAt;
  final String? note;
  final List<VerificationRequirement> requirements;

  factory SellerVerification.fromJson(Map<String, dynamic> json) => SellerVerification(
        status: asString(json['status'], 'none'),
        isVerified: asBool(json['is_verified']),
        canApply: asBool(json['can_apply']),
        submittedAt: asStringOrNull(json['submitted_at']),
        verifiedAt: asStringOrNull(json['verified_at']),
        note: asStringOrNull(json['note']),
        requirements: asList(json['requirements'], VerificationRequirement.fromJson),
      );
}

class SellerStatus {
  const SellerStatus({
    required this.store,
    required this.standing,
    required this.verification,
  });

  final SellerStore store;
  final SellerStanding standing;
  final SellerVerification verification;

  factory SellerStatus.fromJson(Map<String, dynamic> json) => SellerStatus(
        store: SellerStore.fromJson(asMap(json['store'])),
        standing: SellerStanding.fromJson(asMap(json['seller'])),
        verification: SellerVerification.fromJson(asMap(json['verification'])),
      );
}

class SellerStats {
  const SellerStats({
    required this.products,
    required this.inStock,
    required this.outOfStock,
    required this.lowStock,
    required this.orders,
    required this.ordersPending,
    required this.unitsSold,
    required this.earnings,
    required this.paidOut,
    required this.currency,
  });

  final int products;
  final int inStock;
  final int outOfStock;
  final int lowStock;
  final int orders;
  final int ordersPending;
  final int unitsSold;
  final double earnings;
  final double paidOut;
  final String currency;

  factory SellerStats.fromJson(Map<String, dynamic> json) => SellerStats(
        products: asInt(json['products']),
        inStock: asInt(json['in_stock']),
        outOfStock: asInt(json['out_of_stock']),
        lowStock: asInt(json['low_stock']),
        orders: asInt(json['orders']),
        ordersPending: asInt(json['orders_pending']),
        unitsSold: asInt(json['units_sold']),
        earnings: asDouble(json['earnings']),
        paidOut: asDouble(json['paid_out']),
        currency: asString(json['currency'], 'TZS'),
      );
}

class SellerDashboard {
  const SellerDashboard({
    required this.name,
    required this.isApproved,
    required this.stats,
    required this.lowStockProducts,
    this.logo,
    this.since,
  });

  final String name;
  final String? logo;
  final bool isApproved;
  final String? since;
  final SellerStats stats;
  final List<ProductCardModel> lowStockProducts;

  factory SellerDashboard.fromJson(Map<String, dynamic> json) {
    final vendor = asMap(json['vendor']);
    return SellerDashboard(
      name: asString(vendor['name']),
      logo: asStringOrNull(vendor['logo']),
      isApproved: asBool(vendor['is_approved']),
      since: asStringOrNull(vendor['since']),
      stats: SellerStats.fromJson(asMap(json['stats'])),
      lowStockProducts: asList(json['low_stock_products'], ProductCardModel.fromJson),
    );
  }
}

/// The stage this line moves to next, as the server computed it.
///
/// Deliberately not derived in the app: an imported line's journey has stops a
/// local one never makes (customs, local warehouse), and `OrderJourney::path()`
/// on the server is the only place that knows which path this line is on.
class NextStage {
  const NextStage({required this.value, required this.label});

  final String value;
  final String label;

  static NextStage? maybe(Object? value) {
    final map = asMapOrNull(value);
    if (map == null) return null;
    return NextStage(value: asString(map['value']), label: asString(map['label']));
  }
}

/// One line of a seller's order book.
class SellerOrderLine {
  const SellerOrderLine({
    required this.id,
    required this.reference,
    required this.status,
    required this.statusLabel,
    required this.quantity,
    required this.total,
    required this.isImport,
    this.nextStage,
    this.productName,
    this.productImage,
    this.customerName,
    this.address,
    this.placedAt,
  });

  final int id;
  final String reference;
  final String status;
  final String statusLabel;
  final int quantity;
  final double total;

  /// A line 2KONECT is importing travels a longer road than a local one.
  final bool isImport;
  final NextStage? nextStage;
  final String? productName;
  final String? productImage;
  final String? customerName;
  final String? address;
  final DateTime? placedAt;

  /// Closed lines cannot be moved on, and the server refuses to try.
  bool get isOpen => nextStage != null;

  factory SellerOrderLine.fromJson(Map<String, dynamic> json) {
    final product = asMapOrNull(json['product']);
    final customer = asMapOrNull(json['customer']);
    return SellerOrderLine(
      id: asInt(json['id']),
      reference: asString(json['reference']),
      status: asString(json['status']),
      statusLabel: asString(json['status_label']),
      quantity: asInt(json['quantity'], 1),
      total: asDouble(json['total']),
      isImport: asString(json['fulfilment_type'], 'local') == 'import',
      nextStage: NextStage.maybe(json['next_status']),
      productName: product == null ? null : asStringOrNull(product['name']),
      productImage: product == null ? null : asStringOrNull(product['image']),
      customerName: customer == null ? null : asStringOrNull(customer['name']),
      address: asStringOrNull(json['address']),
      placedAt: asDate(json['placed_at']),
    );
  }
}
