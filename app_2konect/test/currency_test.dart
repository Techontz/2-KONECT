import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:app_2konect/core/format.dart';

/// There is one marketplace currency, and the app cannot ask for another.
///
/// The currency screen, its provider and the `X-Currency` header have all been
/// removed. 2KONECT prices in Tanzanian Shillings and shows Tanzanian
/// Shillings, so a price on a phone no longer depends on an exchange rate
/// being right — which is what let a mistyped rate reprice a whole catalogue.
void main() {
  group('the app cannot switch currency', () {
    test('the currency screen and provider are gone', () {
      expect(File('lib/features/account/currency_screen.dart').existsSync(), isFalse);
      expect(File('lib/providers/currency.dart').existsSync(), isFalse);
    });

    test('no request carries a currency header', () {
      final client = File('lib/core/network/api_client.dart').readAsStringSync();
      expect(client.contains('X-Currency'), isFalse);
      expect(client.contains('displayCurrency'), isFalse);
    });

    test('nothing routes to a currency screen', () {
      final router = File('lib/core/router/app_router.dart').readAsStringSync();
      expect(router.contains('CurrencyScreen'), isFalse);
      expect(router.contains("'/currency'"), isFalse);
    });
  });

  group('a stored price reaches the screen unchanged', () {
    test('the figures from the incident reports', () {
      expect(Money.format(7000, 'TZS'), 'TZS 7,000');
      expect(Money.format(2500000, 'TZS'), 'TZS 2,500,000');
      expect(Money.format(2700000, 'TZS'), 'TZS 2,700,000');
      expect(Money.format(50000, 'TZS'), 'TZS 50,000');
    });

    test('never a dollar sign on a shilling amount', () {
      for (final stored in [7000, 2500000, 2700000]) {
        expect(Money.format(stored, 'TZS'), isNot(contains(r'$')));
      }
    });

    test('shillings carry no decimals', () {
      expect(Money.format(7000, 'TZS'), 'TZS 7,000');
      expect(Money.format(49999.83, 'TZS'), 'TZS 50,000');
    });

    test('a missing amount renders as nothing, never as NaN', () {
      expect(Money.format(null, 'TZS'), '');
    });
  });

  /// An order agreed in another currency before the switcher was removed still
  /// renders from its own snapshot. That is history, not choice.
  group('historical orders', () {
    test('still render in the currency they were agreed in', () {
      expect(Money.format(40, 'USD'), r'$40.00');
      expect(Money.format(100000, 'TZS'), 'TZS 100,000');
    });
  });
}
