import 'json.dart';

enum UserRole {
  user,
  vendor,
  admin;

  static UserRole parse(Object? value) {
    switch (asString(value)) {
      case 'vendor':
        return UserRole.vendor;
      case 'admin':
        return UserRole.admin;
      default:
        return UserRole.user;
    }
  }
}

class VendorRef {
  const VendorRef({
    required this.id,
    required this.businessName,
    required this.isApproved,
    this.logo,
  });

  final int id;
  final String businessName;
  final bool isApproved;
  final String? logo;

  factory VendorRef.fromJson(Map<String, dynamic> json) => VendorRef(
        id: asInt(json['id']),
        businessName: asString(json['business_name']),
        isApproved: asBool(json['is_approved']),
        logo: asStringOrNull(json['logo']),
      );

  static VendorRef? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : VendorRef.fromJson(map);
  }
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.phone,
    this.avatarUrl,
    this.vendor,
  });

  final int id;
  final String name;
  final String email;
  final String? phone;
  final String? avatarUrl;
  final UserRole role;
  final VendorRef? vendor;

  bool get isSeller => vendor != null;

  /// The seller console is only useful once an administrator has approved the
  /// store; before that the account has an application, not a shop.
  bool get sellerApproved => vendor?.isApproved ?? false;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.characters1();
    return '${parts.first.characters1()}${parts.last.characters1()}';
  }

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: asInt(json['id']),
        name: asString(json['name'], '2KONECT Shopper'),
        email: asString(json['email']),
        phone: asStringOrNull(json['phone']),
        avatarUrl: asStringOrNull(json['avatar_url']),
        role: UserRole.parse(json['role']),
        vendor: VendorRef.maybe(json['vendor']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'avatar_url': avatarUrl,
        'role': role.name,
        'vendor': vendor == null
            ? null
            : {
                'id': vendor!.id,
                'business_name': vendor!.businessName,
                'is_approved': vendor!.isApproved,
                'logo': vendor!.logo,
              },
      };
}

extension on String {
  String characters1() => isEmpty ? '' : substring(0, 1).toUpperCase();
}

/// A saved delivery address. Mirrors `Api\Shop\AddressController::present()`.
class Address {
  const Address({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.region,
    required this.city,
    required this.isDefault,
    required this.formatted,
    this.district,
    this.street,
    this.details,
    this.latitude,
    this.longitude,
  });

  final int id;
  final String fullName;
  final String phone;
  final String region;
  final String city;
  final String? district;
  final String? street;
  final String? details;
  final double? latitude;
  final double? longitude;
  final bool isDefault;

  /// Courier-readable single line, composed by the backend.
  final String formatted;

  factory Address.fromJson(Map<String, dynamic> json) => Address(
        id: asInt(json['id']),
        fullName: asString(json['full_name']),
        phone: asString(json['phone']),
        region: asString(json['region']),
        city: asString(json['city']),
        district: asStringOrNull(json['district']),
        street: asStringOrNull(json['street']),
        details: asStringOrNull(json['details']),
        latitude: asDoubleOrNull(json['latitude']),
        longitude: asDoubleOrNull(json['longitude']),
        isDefault: asBool(json['is_default']),
        formatted: asString(json['formatted']),
      );

  Map<String, dynamic> toInput() => {
        'full_name': fullName,
        'phone': phone,
        'region': region,
        'city': city,
        'district': district,
        'street': street,
        'details': details,
        'latitude': latitude,
        'longitude': longitude,
        'is_default': isDefault,
      };
}

/// A sourcing request: "find this for me".
class SourcingRequest {
  const SourcingRequest({
    required this.reference,
    required this.name,
    required this.quantity,
    required this.status,
    required this.statusLabel,
    required this.step,
    required this.totalSteps,
    required this.isOpen,
    this.description,
    this.brand,
    this.budgetMax,
    this.image,
    this.quote,
    this.note,
    this.createdAt,
  });

  final String reference;
  final String name;
  final String? description;
  final String? brand;
  final int quantity;
  final double? budgetMax;
  final String? image;
  final String status;
  final String statusLabel;
  final int step;
  final int totalSteps;
  final bool isOpen;
  final SourcingQuote? quote;
  final String? note;
  final DateTime? createdAt;

  factory SourcingRequest.fromJson(Map<String, dynamic> json) => SourcingRequest(
        reference: asString(json['reference']),
        name: asString(json['name']),
        description: asStringOrNull(json['description']),
        brand: asStringOrNull(json['brand']),
        quantity: asInt(json['quantity'], 1),
        budgetMax: asDoubleOrNull(json['budget_max']),
        image: asStringOrNull(json['image']),
        status: asString(json['status']),
        statusLabel: asString(json['status_label']),
        step: asInt(json['step']),
        totalSteps: asInt(json['total_steps'], 1),
        isOpen: asBool(json['is_open']),
        quote: SourcingQuote.maybe(json['quote']),
        note: asStringOrNull(json['note']),
        createdAt: asDate(json['created_at']),
      );
}

class SourcingQuote {
  const SourcingQuote({
    required this.price,
    required this.currency,
    this.etaMin,
    this.etaMax,
    this.quotedAt,
  });

  final double price;
  final String currency;
  final int? etaMin;
  final int? etaMax;
  final DateTime? quotedAt;

  static SourcingQuote? maybe(Object? value) {
    final map = asMapOrNull(value);
    if (map == null) return null;
    return SourcingQuote(
      price: asDouble(map['price']),
      currency: asString(map['currency'], 'TZS'),
      etaMin: asIntOrNull(map['eta_min']),
      etaMax: asIntOrNull(map['eta_max']),
      quotedAt: asDate(map['quoted_at']),
    );
  }
}

/// An application to sell on 2KONECT.
class VendorApplication {
  const VendorApplication({
    required this.reference,
    required this.businessName,
    required this.status,
    required this.statusLabel,
    this.note,
    this.reviewedAt,
    this.createdAt,
  });

  final String reference;
  final String businessName;
  final String status;
  final String statusLabel;
  final String? note;
  final DateTime? reviewedAt;
  final DateTime? createdAt;

  bool get isPending => status == 'pending' || status == 'reviewing';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';

  factory VendorApplication.fromJson(Map<String, dynamic> json) => VendorApplication(
        reference: asString(json['reference']),
        businessName: asString(json['business_name']),
        status: asString(json['status']),
        statusLabel: asString(json['status_label']),
        note: asStringOrNull(json['note']),
        reviewedAt: asDate(json['reviewed_at']),
        createdAt: asDate(json['created_at']),
      );

  static VendorApplication? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : VendorApplication.fromJson(map);
  }
}
