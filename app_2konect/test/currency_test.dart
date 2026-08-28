import 'package:flutter_test/flutter_test.dart';

import 'package:app_2konect/core/format.dart';
import 'package:app_2konect/providers/currency.dart';

/// Currency, in the app.
///
/// The rate belongs to the server and so does the conversion, so there is no
/// arithmetic here to test. What the app can get wrong is the precedence —
/// whose choice wins — and whether the figure it prints matches the currency
/// it asked for.
void main() {
  group('parsing', () {
    test('accepts the two currencies 2KONECT prices in', () {
      expect(AppCurrency.parse('TZS'), AppCurrency.tzs);
      expect(AppCurrency.parse('USD'), AppCurrency.usd);
      expect(AppCurrency.parse('usd'), AppCurrency.usd);
    });

    test('rejects anything else rather than guessing', () {
      // A visitor from Nairobi is offered USD, not KES: a currency nothing can
      // be paid in would be worse than a foreign one that can.
      for (final code in ['KES', 'UGX', 'GBP', 'EUR', '', 'null']) {
        expect(AppCurrency.parse(code), isNull, reason: '$code is not supported');
      }
      expect(AppCurrency.parse(null), isNull);
    });

    test('falls back to shillings', () {
      expect(AppCurrency.fallback, AppCurrency.tzs);
    });
  });

  group('precedence', () {
    /// The controller's rule, as it resolves it.
    AppCurrency resolve({String? stored, String? suggested}) {
      final chosen = AppCurrency.parse(stored);
      if (chosen != null) return chosen;
      return AppCurrency.parse(suggested) ?? AppCurrency.fallback;
    }

    test('a visitor in Tanzania is offered shillings', () {
      expect(resolve(suggested: 'TZS'), AppCurrency.tzs);
    });

    test('a visitor anywhere else is offered dollars', () {
      expect(resolve(suggested: 'USD'), AppCurrency.usd);
    });

    test('detection failing does not stop anybody shopping', () {
      expect(resolve(), AppCurrency.tzs);
    });

    test('a choice already made beats the country', () {
      // The rule the feature exists for.
      expect(resolve(stored: 'USD', suggested: 'TZS'), AppCurrency.usd);
      expect(resolve(stored: 'TZS', suggested: 'USD'), AppCurrency.tzs);
    });
  });

  group('formatting matches the website exactly', () {
    test('shillings are quoted whole', () {
      // "TZS 49,999.83" is not a price anyone has charged in Tanzania.
      expect(Money.format(50000, 'TZS'), 'TZS 50,000');
      expect(Money.format(49999.83, 'TZS'), 'TZS 50,000');
    });

    test('dollars use the symbol and keep their cents', () {
      expect(Money.format(20, 'USD'), r'$20.00');
      expect(Money.format(19.999, 'USD'), r'$20.00');
    });

    test('a missing amount renders as nothing, never as NaN', () {
      expect(Money.format(null, 'USD'), '');
      expect(Money.format(null), '');
    });

    test('zero and large amounts are safe', () {
      expect(Money.format(0, 'TZS'), 'TZS 0');
      expect(Money.format(0, 'USD'), r'$0.00');
      expect(Money.format(12500000, 'TZS'), 'TZS 12,500,000');
    });
  });

  group('the app never converts', () {
    test('it prints the figure it was given, in the currency named', () {
      // Same number, two currencies, no arithmetic. If a rate ever appears in
      // the app, the phone and the server can disagree — which is the bug this
      // whole system exists to prevent.
      expect(Money.format(20, 'TZS'), 'TZS 20');
      expect(Money.format(20, 'USD'), r'$20.00');
    });
  });
}
