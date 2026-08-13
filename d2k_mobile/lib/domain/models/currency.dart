/// The currencies D2K trades in.
///
/// Every price in the catalogue is stored once, in the base currency
/// ([Currency.tzs]). Conversion happens in a single place — `CurrencyService` —
/// so no widget ever performs arithmetic on money.
enum Currency {
  tzs(
    code: 'TZS',
    symbol: 'TZS',
    englishName: 'Tanzanian Shilling',
    nativeName: 'Shilingi ya Tanzania',
    decimals: 0,
  ),
  usd(
    code: 'USD',
    symbol: '\$',
    englishName: 'US Dollar',
    nativeName: 'Dola ya Marekani',
    decimals: 2,
  );

  const Currency({
    required this.code,
    required this.symbol,
    required this.englishName,
    required this.nativeName,
    required this.decimals,
  });

  final String code;
  final String symbol;
  final String englishName;
  final String nativeName;
  final int decimals;

  /// The currency every catalogue price is authored in.
  static const Currency base = Currency.tzs;

  static Currency fromCode(String? code) => Currency.values.firstWhere(
        (c) => c.code == code,
        orElse: () => base,
      );
}

/// A single exchange-rate table. Rates are expressed as
/// "1 unit of the base currency = `rate` units of the target currency", which
/// is exactly the shape an FX endpoint returns, so this class can be swapped
/// for a remote implementation without touching call sites.
class ExchangeRates {
  const ExchangeRates({
    required this.base,
    required this.rates,
    this.updatedAt,
  });

  final Currency base;
  final Map<Currency, double> rates;
  final DateTime? updatedAt;

  /// Launch defaults. 1 TZS ≈ 0.000387 USD (≈ TZS 2,585 to the dollar).
  static const ExchangeRates fallback = ExchangeRates(
    base: Currency.tzs,
    rates: {Currency.tzs: 1.0, Currency.usd: 0.000387},
  );

  double rateFor(Currency currency) => rates[currency] ?? 1.0;

  ExchangeRates copyWith({Map<Currency, double>? rates, DateTime? updatedAt}) =>
      ExchangeRates(
        base: base,
        rates: rates ?? this.rates,
        updatedAt: updatedAt ?? this.updatedAt,
      );
}

/// An amount of money, always carried in the base currency so that a currency
/// switch never loses precision and never mixes units.
class Money {
  const Money(this.baseAmount);

  /// Amount expressed in [Currency.base] (TZS).
  final double baseAmount;

  static const Money zero = Money(0);

  Money operator +(Money other) => Money(baseAmount + other.baseAmount);
  Money operator -(Money other) => Money(baseAmount - other.baseAmount);
  Money operator *(num factor) => Money(baseAmount * factor);

  bool get isZero => baseAmount.abs() < 0.0001;

  @override
  bool operator ==(Object other) =>
      other is Money && other.baseAmount == baseAmount;

  @override
  int get hashCode => baseAmount.hashCode;

  @override
  String toString() => 'Money(${baseAmount}TZS)';
}
