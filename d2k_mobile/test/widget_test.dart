import 'package:d2k_mobile/domain/models/currency.dart';
import 'package:d2k_mobile/state/currency_controller.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues({
        // Swahili is the app's default; these assertions are written in English.
        'd2k.language': 'en',});

  group('CurrencyController', () {
    test('formats TZS with no decimals and a thousands separator', () {
      final controller = CurrencyController();
      expect(controller.formatValue(45000), 'TZS 45,000');
      expect(controller.formatValue(2500000), 'TZS 2,500,000');
    });

    test('converts the same base price into USD', () async {
      final controller = CurrencyController();
      await controller.select(Currency.usd);
      // 45,000 TZS at the configured fallback rate.
      expect(controller.formatValue(45000), '\$17.41');
    });

    test('a new rate table changes every derived price', () {
      final controller = CurrencyController()
        ..updateRates(const ExchangeRates(
          base: Currency.tzs,
          rates: {Currency.tzs: 1, Currency.usd: 0.0004},
        ));
      expect(controller.convert(100000, to: Currency.usd), 40);
    });
  });

  test('Money arithmetic stays in the base currency', () {
    const a = Money(1000);
    const b = Money(250);
    expect((a + b).baseAmount, 1250);
    expect((a - b).baseAmount, 750);
    expect((a * 3).baseAmount, 3000);
  });
}
