import 'package:app_2konect/core/l10n/strings.dart';
import 'package:app_2konect/core/theme/app_theme.dart';
import 'package:app_2konect/features/checkout/widgets/payment_picker.dart';
import 'package:app_2konect/features/products/widgets/price_filter.dart';
import 'package:app_2konect/models/payment.dart';
import 'package:app_2konect/providers/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The rules that must never regress.
///
/// The server enforces all of them — `App\Support\CheckoutPolicy` refuses a
/// cash-on-delivery import whatever the client asks for — but the interface
/// must not *offer* something the server will refuse, so these assert the
/// screen as well as the model.
Future<Widget> _harness(Widget child) async {
  SharedPreferences.setMockInitialValues({});
  final preferences = await SharedPreferences.getInstance();

  return ProviderScope(
    overrides: [preferencesProvider.overrideWithValue(preferences)],
    child: MaterialApp(
      theme: AppTheme.build(),
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
}

const _lipaNamba = PaymentChannel(
  code: PaymentChannel.lipaNamba,
  label: 'Lipa Namba',
  merchantName: '2KONECT',
  number: '555123',
  requiresReference: true,
  requiresVerification: true,
);

const _mobileMoney = PaymentChannel(
  code: PaymentChannel.mobileMoney,
  label: 'Mobile money',
  requiresReference: true,
  requiresVerification: true,
);

void main() {
  group('cash on delivery is impossible for imports', () {
    testWidgets('no COD option is rendered for a prepaid basket', (tester) async {
      await tester.pumpWidget(await _harness(
        PaymentPicker(
          options: const PaymentOptions(
            requiresPrepayment: true,
            cashOnDelivery: false,
            chargesDelivery: false,
            channels: [_lipaNamba, _mobileMoney],
          ),
          selected: null,
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      // Both prepaid channels offered…
      expect(find.text('Lipa Namba'), findsOneWidget);
      expect(find.text('Mobile money'), findsOneWidget);

      // …and cash on delivery is not present at all — not disabled, not
      // greyed out, not hidden behind a tooltip. Absent.
      expect(find.text('Cash on delivery'), findsNothing);
      expect(find.text('Pay the rider when your order reaches you.'), findsNothing);
    });

    testWidgets('the reason is stated rather than left to be discovered',
        (tester) async {
      await tester.pumpWidget(await _harness(
        PaymentPicker(
          options: const PaymentOptions(
            requiresPrepayment: true,
            cashOnDelivery: false,
            chargesDelivery: false,
            channels: [_lipaNamba],
          ),
          selected: null,
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('not available for products ordered from abroad'),
        findsOneWidget,
      );
    });

    testWidgets('COD IS offered for a purely local basket', (tester) async {
      await tester.pumpWidget(await _harness(
        PaymentPicker(
          options: const PaymentOptions(
            requiresPrepayment: false,
            cashOnDelivery: true,
            chargesDelivery: true,
            channels: [],
          ),
          selected: null,
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      // Removing COD globally would break every local order, so it must stay.
      expect(find.text('Cash on delivery'), findsOneWidget);
    });
  });

  group('no configured channel', () {
    testWidgets('a prepaid basket says payment is unavailable, and offers no COD',
        (tester) async {
      await tester.pumpWidget(await _harness(
        PaymentPicker(
          // Production's real state today: nothing switched on by an admin.
          options: PaymentOptions.unavailable,
          selected: null,
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('not available right now'), findsOneWidget);
      expect(find.text('Cash on delivery'), findsNothing);
    });
  });

  group('no payment number is compiled into the app', () {
    testWidgets('the till number rendered is the one the server sent', (tester) async {
      const fromServer = PaymentChannel(
        code: PaymentChannel.lipaNamba,
        label: 'Lipa Namba',
        merchantName: 'A NUMBER ONLY AN ADMIN CAN SET',
        number: '999888',
        requiresReference: true,
        requiresVerification: true,
      );

      await tester.pumpWidget(await _harness(
        PaymentPicker(
          options: const PaymentOptions(
            requiresPrepayment: true,
            cashOnDelivery: false,
            chargesDelivery: false,
            channels: [fromServer],
          ),
          selected: PaymentChannel.lipaNamba,
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('A NUMBER ONLY AN ADMIN CAN SET'), findsOneWidget);
    });
  });

  group('price ladder is derived from the catalogue', () {
    test('never offers a cap at or above the dearest product', () {
      final ladder = priceLadder(5040000);
      expect(ladder, isNotEmpty);
      expect(ladder.every((rung) => rung < 5040000), isTrue);
    });

    test('a cheap catalogue gets a cheap ladder, not "Under 5M"', () {
      final ladder = priceLadder(90000);
      expect(ladder.every((rung) => rung < 90000), isTrue);
      expect(ladder.contains(5000000), isFalse);
    });

    test('an empty or nonsensical ceiling produces no ladder at all', () {
      expect(priceLadder(0), isEmpty);
      expect(priceLadder(-5), isEmpty);
      expect(priceLadder(double.nan), isEmpty);
    });

    test('rungs walk the 1 / 2.5 / 5 progression, coarsest last', () {
      final ladder = priceLadder(5040000);
      // 5,000,000 is the coarsest rung still strictly below the ceiling.
      expect(ladder.last, 5000000.0);
      expect(ladder, contains(2500000.0));
      expect(ladder, contains(1000000.0));
      expect(ladder, contains(500000.0));
      // Ascending, so the chips read cheapest-first.
      for (var i = 1; i < ladder.length; i++) {
        expect(ladder[i], greaterThan(ladder[i - 1]));
      }
    });
  });

  group('the max-price filter carries a number, never a label', () {
    testWidgets('choosing a rung reports a plain numeric value', (tester) async {
      double? reported;
      var reports = 0;

      await tester.pumpWidget(await _harness(
        PriceFilter(
          min: 7000,
          max: 5040000,
          value: null,
          onChanged: (value) {
            reported = value;
            reports++;
          },
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Under 1M'));
      await tester.pumpAndSettle();

      expect(reports, 1);
      expect(reported, 1000000.0);
      expect(reported, isA<double>());
    });

    testWidgets('a cap at the ceiling is no cap at all', (tester) async {
      double? reported = 1.0;

      await tester.pumpWidget(await _harness(
        PriceFilter(
          min: 7000,
          max: 5040000,
          value: 1000000,
          onChanged: (value) => reported = value,
        ),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Any price'));
      await tester.pumpAndSettle();

      expect(reported, isNull);
    });
  });

  group('all four languages resolve', () {
    test('every shipped language has the keys the app asks for', () {
      const probes = [
        'nav.home',
        'nav.shop',
        'cart.title',
        'checkout.placeOrder',
        'payment.codUnavailableAbroad',
        'payment.statusPendingVerification',
        'payment.deliveryNotAdded',
        'orders.yourOrders',
        'app.share',
        'app.languageNotCurrency',
      ];

      for (final language in AppLanguage.values) {
        final t = Strings(language);
        for (final key in probes) {
          final value = t(key);
          expect(value, isNotEmpty, reason: '$key missing for ${language.code}');
          // A humanised fallback would come back title-cased from the key.
          expect(value, isNot(equals(key)), reason: '$key unresolved for ${language.code}');
        }
      }
    });

    test('placeholders are substituted, not left in the sentence', () {
      for (final language in AppLanguage.values) {
        final rendered = Strings(language)('orders.referenceLabel', {'reference': 'ORD-1'});
        expect(rendered, contains('ORD-1'));
        expect(rendered, isNot(contains('{reference}')));
      }
    });

    test('Kiswahili is genuinely translated, not English passed through', () {
      expect(Strings(AppLanguage.sw)('nav.home'),
          isNot(equals(Strings(AppLanguage.en)('nav.home'))));
      expect(Strings(AppLanguage.zh)('cart.title'),
          isNot(equals(Strings(AppLanguage.en)('cart.title'))));
    });
  });
}
