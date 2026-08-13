/// A seller, exactly as the backend describes one.
///
/// Two independent facts live here and must never be collapsed into one:
///
///   [isApproved] — the store is allowed to sell.
///   [isVerified] — an administrator granted the public checkmark.
///
/// An approved store is not a verified store. The badge is shown only for
/// [isVerified], which is decided in the admin panel and arrives from the API;
/// the app never infers it.
class Vendor {
  const Vendor({
    required this.id,
    required this.name,
    this.userId,
    this.logo = '',
    this.phone,
    this.phoneDisplay,
    this.whatsapp,
    this.location,
    this.website,
    this.about,
    this.isApproved = false,
    this.isVerified = false,
    this.memberSince,
    this.productCount,
  });

  final String id;
  final String name;

  /// The account behind the store — the counterparty for a chat thread.
  final String? userId;

  final String logo;

  /// Dial-ready number, already normalised by the backend. Null when the
  /// stored number could not be made usable — in that case no call action is
  /// offered rather than a broken one.
  final String? phone;

  /// Human-readable form of [phone], for display only.
  final String? phoneDisplay;

  /// Digits-only international form for wa.me links, or null if unusable.
  final String? whatsapp;

  final String? location;
  final String? website;
  final String? about;

  final bool isApproved;
  final bool isVerified;
  final String? memberSince;
  final int? productCount;

  bool get canCall => (phone ?? '').isNotEmpty;
  bool get canWhatsApp => (whatsapp ?? '').isNotEmpty;

  /// A chat thread needs the seller's user account, not the store row.
  bool get canChat => (userId ?? '').isNotEmpty;

  bool get hasAnyContact => canCall || canWhatsApp || canChat;

  Uri get telUri => Uri.parse('tel:${phone ?? ''}');
  Uri whatsAppUri({String? message}) => Uri.parse(
        'https://wa.me/${whatsapp ?? ''}'
        '${message == null || message.isEmpty ? '' : '?text=${Uri.encodeComponent(message)}'}',
      );

  static Vendor? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;

    String? clean(Object? value) {
      final text = value?.toString().trim() ?? '';
      return text.isEmpty || text == 'null' ? null : text;
    }

    return Vendor(
      id: '${json['id'] ?? ''}',
      name: '${json['name'] ?? ''}'.trim(),
      userId: clean(json['user_id']),
      logo: clean(json['logo']) ?? '',
      phone: clean(json['phone']),
      phoneDisplay: clean(json['phone_display']) ?? clean(json['phone']),
      whatsapp: clean(json['whatsapp']),
      location: clean(json['location']),
      website: clean(json['website']),
      about: clean(json['about']),
      isApproved: json['is_approved'] == true,
      isVerified: json['is_verified'] == true,
      memberSince: clean(json['member_since']),
      productCount: (json['product_count'] as num?)?.toInt() ??
          (json['products_count'] as num?)?.toInt(),
    );
  }
}
