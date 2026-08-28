import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/network/api_client.dart';
import 'core.dart';

/// The two currencies 2KONECT prices in.
enum AppCurrency {
  tzs('TZS', 'TZS', 'Tanzanian Shilling', '🇹🇿'),
  usd('USD', r'$', 'US Dollar', '🇺🇸');

  const AppCurrency(this.code, this.symbol, this.label, this.flag);

  final String code;
  final String symbol;
  final String label;
  final String flag;

  static AppCurrency? parse(String? code) {
    if (code == null) return null;
    final upper = code.toUpperCase();
    for (final value in AppCurrency.values) {
      if (value.code == upper) return value;
    }
    return null;
  }

  static const fallback = AppCurrency.tzs;
}

class CurrencyState {
  const CurrencyState({required this.currency, required this.chosen});

  final AppCurrency currency;

  /// True once the customer has picked one for themselves. Detection never
  /// overrules this — a Tanzanian who chose dollars keeps dollars.
  final bool chosen;
}

/// Which currency this customer reads prices in.
///
/// ---- precedence ----
///
///   1. what they chose, on this run or a previous one
///   2. what the server suggests for their country
///   3. shillings
///
/// The first beats the second, always. Detection decides what somebody is
/// offered before they have an opinion; it never overrules one they have.
///
/// ---- no location permission ----
///
/// The country comes from the backend, which reads the headers its edge already
/// added to the request. The app asks for no location permission to choose
/// between two currencies — a permission dialogue for that would be an absurd
/// trade, and country-level is all that is needed anyway.
///
/// ---- no conversion here ----
///
/// The app never converts. It sends `X-Currency` and the server answers with
/// prices already in that currency, at the rate an administrator set. A rate
/// living in two places is a rate that will eventually disagree with itself.
class CurrencyController extends StateNotifier<CurrencyState> {
  CurrencyController(this._prefs, this._api) : super(_initial(_prefs)) {
    ApiClient.displayCurrency = state.currency.code;

    if (!state.chosen) {
      // Nothing chosen, so ask the server what this country suggests. Failing
      // is fine: shillings and the switcher are already in place.
      _detect();
    }
  }

  final SharedPreferences _prefs;
  final ApiClient _api;

  static const _key = '2konect.currency';

  static CurrencyState _initial(SharedPreferences prefs) {
    final stored = AppCurrency.parse(prefs.getString(_key));

    return stored != null
        ? CurrencyState(currency: stored, chosen: true)
        : const CurrencyState(currency: AppCurrency.fallback, chosen: false);
  }

  Future<void> _detect() async {
    try {
      final data = await _api.get<Map<String, dynamic>>('/shop/currency');
      final suggested = AppCurrency.parse(data['suggested_currency'] as String?);

      // Guard against a slow answer landing after the customer has chosen.
      if (suggested != null && !state.chosen) {
        ApiClient.displayCurrency = suggested.code;
        state = CurrencyState(currency: suggested, chosen: false);
      }
    } catch (_) {
      // Detection is a courtesy. Nobody is stopped from shopping by its
      // absence, and the switcher is one tap away.
    }
  }

  void set(AppCurrency currency) {
    if (currency == state.currency && state.chosen) return;

    // Set before the state changes, so anything that refetches on the rebuild
    // already asks for the new currency.
    ApiClient.displayCurrency = currency.code;
    state = CurrencyState(currency: currency, chosen: true);
    _prefs.setString(_key, currency.code);
  }
}

final currencyControllerProvider =
    StateNotifierProvider<CurrencyController, CurrencyState>((ref) {
  return CurrencyController(
    ref.watch(preferencesProvider),
    ref.watch(apiClientProvider),
  );
});

/// The active currency code, for anything that only needs to format.
final currencyCodeProvider = Provider<String>(
  (ref) => ref.watch(currencyControllerProvider).currency.code,
);
