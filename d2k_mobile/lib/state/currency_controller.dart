import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/models/currency.dart';

/// The single place in the application where money is converted and formatted.
///
/// Widgets call [format] / [formatValue]; they never multiply by a rate and
/// never build a currency string by hand, so a rate change or a new currency
/// propagates everywhere at once.
class CurrencyController extends ChangeNotifier {
  CurrencyController({ExchangeRates? rates})
      : _rates = rates ?? ExchangeRates.fallback;

  static const String _prefsKey = 'd2k.currency';

  Currency _selected = Currency.base;
  ExchangeRates _rates;

  Currency get selected => _selected;
  ExchangeRates get rates => _rates;

  final NumberFormat _tzsFormat = NumberFormat('#,##0', 'en_US');
  final NumberFormat _usdFormat = NumberFormat('#,##0.00', 'en_US');

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _selected = Currency.fromCode(prefs.getString(_prefsKey));
    notifyListeners();
  }

  Future<void> select(Currency currency) async {
    if (_selected == currency) return;
    _selected = currency;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, currency.code);
  }

  /// Replace the rate table — e.g. after an FX endpoint responds.
  void updateRates(ExchangeRates rates) {
    _rates = rates;
    notifyListeners();
  }

  /// Converts a base-currency (TZS) amount into the selected currency.
  double convert(double baseAmount, {Currency? to}) =>
      baseAmount * _rates.rateFor(to ?? _selected);

  /// "TZS 45,000" / "$17.40"
  String format(Money money, {Currency? currency, bool compact = false}) =>
      formatValue(money.baseAmount, currency: currency, compact: compact);

  String formatValue(
    double baseAmount, {
    Currency? currency,
    bool compact = false,
  }) {
    final target = currency ?? _selected;
    final value = convert(baseAmount, to: target);
    if (compact) return '${target.symbol} ${_compact(value, target)}';
    return switch (target) {
      Currency.tzs => 'TZS ${_tzsFormat.format(value)}',
      Currency.usd => '\$${_usdFormat.format(value)}',
    };
  }

  /// Number only — used where the symbol is rendered separately
  /// (struck-through original prices in the reference product card).
  String formatBare(double baseAmount, {Currency? currency}) {
    final target = currency ?? _selected;
    final value = convert(baseAmount, to: target);
    return switch (target) {
      Currency.tzs => _tzsFormat.format(value),
      Currency.usd => _usdFormat.format(value),
    };
  }

  String _compact(double value, Currency target) {
    if (target == Currency.usd) return _usdFormat.format(value);
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(value % 1000000 == 0 ? 0 : 1)}M';
    }
    if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(0)}K';
    }
    return _tzsFormat.format(value);
  }

  /// Human readable rate line for the currency picker.
  String get rateSummary {
    final usd = _rates.rateFor(Currency.usd);
    if (usd == 0) return '';
    final perDollar = 1 / usd;
    // A rate is only quoted when it came from somewhere datable. The launch
    // constant is a conversion factor, not a live market rate, and showing it
    // as one tells the shopper something we do not actually know.
    if (_rates.updatedAt == null) {
      return 'Prices are in TZS. USD amounts are approximate.';
    }
    return '1 USD ≈ TZS ${_tzsFormat.format(perDollar)}';
  }
}
