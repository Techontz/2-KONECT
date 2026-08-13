/// A country D2K ships to. Tanzania is the launch market and the default.
class ShippingCountry {
  const ShippingCountry({
    required this.code,
    required this.name,
    required this.flag,
    required this.dialCode,
    required this.cities,
    this.isPrimary = false,
  });

  final String code;
  final String name;
  final String flag;
  final String dialCode;
  final List<String> cities;
  final bool isPrimary;
}

/// A saved or in-progress delivery location.
class DeliveryLocation {
  const DeliveryLocation({
    required this.label,
    required this.area,
    required this.city,
    required this.countryName,
  });

  final String label;
  final String area;
  final String city;
  final String countryName;

  static const DeliveryLocation kariakoo = DeliveryLocation(
    label: 'Other',
    area: 'Kariakoo Market',
    city: 'Dar es Salaam',
    countryName: 'Tanzania',
  );

  String get summary => '$area - $city - $countryName';

  DeliveryLocation copyWith({
    String? label,
    String? area,
    String? city,
    String? countryName,
  }) =>
      DeliveryLocation(
        label: label ?? this.label,
        area: area ?? this.area,
        city: city ?? this.city,
        countryName: countryName ?? this.countryName,
      );
}
