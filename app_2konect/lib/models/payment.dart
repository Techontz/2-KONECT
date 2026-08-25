import 'json.dart';

/// Where an order stands with money, as opposed to which method was chosen.
///
/// Deliberately a separate axis from order status and delivery status. Merging
/// them is how a marketplace ends up telling somebody their order is
/// "complete" when nobody has been paid.
enum PaymentStatus {
  /// Cash on delivery — nothing to pay now.
  notRequired,
  awaitingPayment,
  awaitingVerification,
  verified,
  rejected;

  static PaymentStatus parse(Object? value) {
    switch (asString(value)) {
      case 'not_required':
        return PaymentStatus.notRequired;
      case 'awaiting_verification':
        return PaymentStatus.awaitingVerification;
      case 'verified':
        return PaymentStatus.verified;
      case 'rejected':
        return PaymentStatus.rejected;
      default:
        return PaymentStatus.awaitingPayment;
    }
  }

  /// True while the customer still has to send money.
  bool get needsPayment => this == PaymentStatus.awaitingPayment || this == PaymentStatus.rejected;

  bool get isSettled => this == PaymentStatus.verified || this == PaymentStatus.notRequired;
}

/// A way to pay 2KONECT, read from the server.
///
/// The till number is deliberately not in this repository. It changes without
/// a release, an administrator owns it, and a number compiled into an APK is a
/// number that is wrong the day it changes — wrong in a way that sends real
/// money to somebody else.
class PaymentChannel {
  const PaymentChannel({
    required this.code,
    required this.label,
    required this.requiresReference,
    required this.requiresVerification,
    this.isGateway = false,
    this.merchantName,
    this.number,
    this.instructions,
  });

  /// `lipa_namba`, `mobile_money`, or whatever an administrator adds.
  final String code;
  final String label;
  final String? merchantName;

  /// The till / Lipa Namba number. Always from the server, never a constant.
  final String? number;
  final String? instructions;
  final bool requiresReference;
  final bool requiresVerification;

  /// Does the shopper get sent somewhere to pay, rather than reading a number
  /// off the screen?
  ///
  /// Branch on this, never on `code == 'stripe'`. What counts as a gateway is
  /// the server's to say, for the same reason the till number is — a second
  /// gateway added later must not need an app release to appear.
  final bool isGateway;

  static const lipaNamba = 'lipa_namba';
  static const mobileMoney = 'mobile_money';
  static const cashOnDelivery = 'cash_on_delivery';

  bool get isCashOnDelivery => code == cashOnDelivery;

  factory PaymentChannel.fromJson(Map<String, dynamic> json) => PaymentChannel(
        code: asString(json['code']),
        label: asString(json['label']),
        merchantName: asStringOrNull(json['merchant_name']),
        number: asStringOrNull(json['number']),
        instructions: asStringOrNull(json['instructions']),
        requiresReference: asBool(json['requires_reference'], true),
        requiresVerification: asBool(json['requires_verification'], true),
        isGateway: asBool(json['is_gateway']),
      );
}

/// What this basket may be paid with, decided by the server.
///
/// The `import` hint the app sends is a hint, not a permission: the same rule
/// is applied again against the real products when the order is placed, so a
/// client that lied about it gets a refusal rather than cash on delivery.
class PaymentOptions {
  const PaymentOptions({
    required this.requiresPrepayment,
    required this.cashOnDelivery,
    required this.chargesDelivery,
    required this.channels,
  });

  /// True when the basket holds anything sourced from abroad.
  final bool requiresPrepayment;

  /// Whether cash on delivery may be offered at all.
  final bool cashOnDelivery;

  /// Whether a delivery fee belongs on this checkout.
  final bool chargesDelivery;
  final List<PaymentChannel> channels;

  /// A prepaid basket with nothing switched on cannot be paid for at all —
  /// and checkout has to say so rather than quietly falling back to COD.
  bool get hasNoWayToPay => requiresPrepayment && channels.isEmpty;

  factory PaymentOptions.fromJson(Map<String, dynamic> json) => PaymentOptions(
        requiresPrepayment: asBool(json['requires_prepayment']),
        cashOnDelivery: asBool(json['cash_on_delivery']),
        chargesDelivery: asBool(json['charges_delivery']),
        channels: asList(json['channels'], PaymentChannel.fromJson),
      );

  static const unavailable = PaymentOptions(
    requiresPrepayment: true,
    cashOnDelivery: false,
    chargesDelivery: false,
    channels: [],
  );
}
