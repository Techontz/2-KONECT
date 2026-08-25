import 'json.dart';

/// A money figure as the server composed it. The client never recalculates it.
class Price {
  const Price({
    required this.currency,
    required this.current,
    this.was,
    this.discountPercent,
  });

  final String currency;
  final double current;
  final double? was;
  final int? discountPercent;

  factory Price.fromJson(Map<String, dynamic> json) => Price(
        currency: asString(json['currency'], 'TZS'),
        current: asDouble(json['current']),
        was: asDoubleOrNull(json['was']),
        discountPercent: asIntOrNull(json['discount_percent']),
      );

  static const zero = Price(currency: 'TZS', current: 0);

  bool get isDiscounted => was != null && was! > current;
}

class Rating {
  const Rating({required this.average, required this.count});

  final double average;
  final int count;

  factory Rating.fromJson(Map<String, dynamic> json) => Rating(
        average: asDouble(json['average']),
        count: asInt(json['count']),
      );

  static const none = Rating(average: 0, count: 0);

  bool get hasReviews => count > 0;
}

class RatingBar {
  const RatingBar({required this.star, required this.count, required this.percent});

  final int star;
  final int count;
  final int percent;

  factory RatingBar.fromJson(Map<String, dynamic> json) => RatingBar(
        star: asInt(json['star']),
        count: asInt(json['count']),
        percent: asInt(json['percent']),
      );
}

class DetailedRating {
  const DetailedRating({required this.rating, required this.distribution});

  final Rating rating;
  final List<RatingBar> distribution;

  factory DetailedRating.fromJson(Map<String, dynamic> json) => DetailedRating(
        rating: Rating.fromJson(json),
        distribution: asList(json['distribution'], RatingBar.fromJson),
      );

  static const none = DetailedRating(rating: Rating.none, distribution: []);
}

/// An `{id, name}` pair — a category, subcategory or vendor reference.
class Ref {
  const Ref({required this.id, required this.name, this.isVerified = false});

  final int id;
  final String name;
  final bool isVerified;

  factory Ref.fromJson(Map<String, dynamic> json) => Ref(
        id: asInt(json['id']),
        name: asString(json['name']),
        isVerified: asBool(json['is_verified']),
      );

  static Ref? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : Ref.fromJson(map);
  }
}

class Country {
  const Country({required this.code, required this.name, required this.flag});

  final String code;
  final String name;
  final String flag;

  factory Country.fromJson(Map<String, dynamic> json) => Country(
        code: asString(json['code']),
        name: asString(json['name']),
        flag: asString(json['flag']),
      );

  static Country? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : Country.fromJson(map);
  }
}

/// A country plus how many products come from it — a listing facet.
class CountryFacet {
  const CountryFacet({required this.country, required this.count});

  final Country country;
  final int count;

  factory CountryFacet.fromJson(Map<String, dynamic> json) => CountryFacet(
        country: Country.fromJson(json),
        count: asInt(json['count']),
      );
}

class LeadTime {
  const LeadTime({required this.min, required this.max, required this.label});

  final int min;
  final int max;

  /// Pre-composed by the server, e.g. "1–3 days".
  final String label;

  factory LeadTime.fromJson(Map<String, dynamic> json) => LeadTime(
        min: asInt(json['min']),
        max: asInt(json['max']),
        label: asString(json['label']),
      );

  static const unknown = LeadTime(min: 0, max: 0, label: '');

  static LeadTime? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : LeadTime.fromJson(map);
  }
}

/// Is it here, or is it coming? The distinction the marketplace is built on.
enum Availability {
  local,
  import;

  static Availability parse(Object? value) =>
      asString(value) == 'import' ? Availability.import : Availability.local;

  String get wire => name;
  bool get isImport => this == Availability.import;
}

class ShippingMethod {
  const ShippingMethod({required this.code, required this.label});

  final String code;
  final String label;

  static ShippingMethod? maybe(Object? value) {
    final map = asMapOrNull(value);
    if (map == null) return null;
    return ShippingMethod(code: asString(map['code']), label: asString(map['label']));
  }
}

/// Where a product is and when it lands, composed once by `App\Support\Sourcing`
/// so every surface says the same thing.
class Sourcing {
  const Sourcing({
    required this.type,
    required this.label,
    required this.headline,
    required this.summary,
    required this.leadTime,
    this.origin,
    this.destination,
    this.shippingMethod,
    this.fulfilmentLocation,
  });

  final Availability type;

  /// Short form for a card: "In Tanzania" / "Order from abroad".
  final String label;

  /// Long form for a product page: "Available in Tanzania" / "Sourced from China".
  final String headline;
  final String summary;
  final LeadTime leadTime;
  final Country? origin;
  final Country? destination;
  final ShippingMethod? shippingMethod;
  final String? fulfilmentLocation;

  bool get isLocal => type == Availability.local;
  bool get isImport => type == Availability.import;

  factory Sourcing.fromJson(Map<String, dynamic> json) => Sourcing(
        type: Availability.parse(json['type']),
        label: asString(json['label']),
        headline: asString(json['headline']),
        summary: asString(json['summary']),
        leadTime: LeadTime.maybe(json['lead_time']) ?? LeadTime.unknown,
        origin: Country.maybe(json['origin']),
        destination: Country.maybe(json['destination']),
        shippingMethod: ShippingMethod.maybe(json['shipping_method']),
        fulfilmentLocation: asStringOrNull(json['fulfilment_location']),
      );

  /// Used when a payload predates sourcing, so a card still renders.
  static const localFallback = Sourcing(
    type: Availability.local,
    label: 'In Tanzania',
    headline: 'Available in Tanzania',
    summary: 'In stock locally and ready to ship.',
    leadTime: LeadTime(min: 1, max: 3, label: '1–3 days'),
  );

  static Sourcing of(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? localFallback : Sourcing.fromJson(map);
  }
}
