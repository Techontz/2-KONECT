import 'package:app_2konect/core/theme/app_theme.dart';
import 'package:app_2konect/features/checkout/widgets/payment_picker.dart';
import 'package:app_2konect/models/payment.dart';
import 'package:app_2konect/providers/language.dart';
import 'package:app_2konect/providers/core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The card-payment channel, as the app sees it.
///
/// The rules the marketplace cannot lose are re-asserted here rather than
/// assumed: a gateway appearing must not make cash on delivery appear on an
/// import, and must not make a till number appear where there is none.
Future<Widget> _harness(Widget child, {String language = 'en'}) async {
  SharedPreferences.setMockInitialValues({'language': language});
  final preferences = await SharedPreferences.getInstance();

  return ProviderScope(
    overrides: [preferencesProvider.overrideWithValue(preferences)],
    child: MaterialApp(
      theme: AppTheme.build(),
      home: Scaffold(body: SingleChildScrollView(child: child)),
    ),
  );
}

const _stripe = PaymentChannel(
  code: 'stripe',
  label: 'Card payment',
  requiresReference: false,
  requiresVerification: false,
  isGateway: true,
  instructions: 'Pay securely by card.',
);

const _lipaNamba = PaymentChannel(
  code: PaymentChannel.lipaNamba,
  label: 'Lipa Namba',
  merchantName: '2KONECT',
  number: '555123',
  requiresReference: true,
  requiresVerification: true,
);

void main() {
  group('the gateway flag is read from the server, never inferred', () {
    test('a channel is a gateway only when the server says so', () {
      final gateway = PaymentChannel.fromJson({
        'code': 'stripe',
        'label': 'Card payment',
        'number': null,
        'requires_reference': false,
        'requires_verification': false,
        'is_gateway': true,
      });

      expect(gateway.isGateway, isTrue);
      expect(gateway.number, isNull);
      expect(gateway.requiresReference, isFalse);
    });

    test('a manual channel is not a gateway', () {
      final manual = PaymentChannel.fromJson({
        'code': 'lipa_namba',
        'label': 'Lipa Namba',
        'number': '555123',
        'requires_reference': true,
        'requires_verification': true,
        'is_gateway': false,
      });

      expect(manual.isGateway, isFalse);
      expect(manual.number, '555123');
    });

    test('an older server that omits the flag is treated as manual', () {
      // Fail safe: an unknown channel gets the reference-and-verify flow,
      // never a redirect to a page the app cannot produce.
      final legacy = PaymentChannel.fromJson({
        'code': 'lipa_namba',
        'label': 'Lipa Namba',
        'requires_reference': true,
        'requires_verification': true,
      });

      expect(legacy.isGateway, isFalse);
    });
  });

  group('the picker renders a gateway alongside manual channels', () {
    testWidgets('a gateway channel is offered', (tester) async {
      await tester.pumpWidget(await _harness(
        PaymentPicker(
          options: const PaymentOptions(
            requiresPrepayment: true,
            cashOnDelivery: false,
            chargesDelivery: false,
            channels: [_stripe],
          ),
          selected: 'stripe',
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Card payment'), findsOneWidget);
    });

    testWidgets('a gateway shows no till number to copy', (tester) async {
      await tester.pumpWidget(await _harness(
        PaymentPicker(
          options: const PaymentOptions(
            requiresPrepayment: true,
            cashOnDelivery: false,
            chargesDelivery: false,
            channels: [_stripe],
          ),
          selected: 'stripe',
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      // There is nothing to pay *to* — the number belongs to a manual channel.
      expect(find.text('555123'), findsNothing);
    });

    testWidgets('manual channels are unchanged by the gateway existing', (tester) async {
      await tester.pumpWidget(await _harness(
        PaymentPicker(
          options: const PaymentOptions(
            requiresPrepayment: true,
            cashOnDelivery: false,
            chargesDelivery: false,
            channels: [_stripe, _lipaNamba],
          ),
          selected: PaymentChannel.lipaNamba,
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Lipa Namba'), findsWidgets);
      expect(find.text('Card payment'), findsOneWidget);
    });
  });

  group('the import rules are untouched by adding a gateway', () {
    testWidgets('cash on delivery is still absent from a prepaid basket', (tester) async {
      await tester.pumpWidget(await _harness(
        PaymentPicker(
          options: const PaymentOptions(
            requiresPrepayment: true,
            cashOnDelivery: false,
            chargesDelivery: false,
            channels: [_stripe],
          ),
          selected: 'stripe',
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      // Not rendered disabled, not explained away — simply not there.
      expect(find.text('Cash on delivery'), findsNothing);
    });

    testWidgets('cash on delivery still appears for a local basket', (tester) async {
      await tester.pumpWidget(await _harness(
        PaymentPicker(
          options: const PaymentOptions(
            requiresPrepayment: false,
            cashOnDelivery: true,
            chargesDelivery: true,
            channels: [_stripe],
          ),
          selected: PaymentChannel.cashOnDelivery,
          onSelect: (_) {},
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Cash on delivery'), findsOneWidget);
    });

    test('a prepaid basket with no channel at all still says so', () {
      const options = PaymentOptions(
        requiresPrepayment: true,
        cashOnDelivery: false,
        chargesDelivery: false,
        channels: [],
      );

      // Never falls back to cash on delivery, which is the whole point.
      expect(options.hasNoWayToPay, isTrue);
    });
  });

  group('gateway strings resolve in every language', () {
    for (final code in ['en', 'sw', 'fr', 'zh']) {
      testWidgets('$code has the gateway copy', (tester) async {
        late String secure;
        late String note;

        await tester.pumpWidget(await _harness(
          Consumer(builder: (context, ref, _) {
            secure = ref.t('payment.paySecurely');
            note = ref.t('payment.gatewayNote');
            return const SizedBox.shrink();
          }),
          language: code,
        ));
        await tester.pumpAndSettle();

        // A missing key returns the key itself; that must never ship.
        expect(secure, isNot(contains('payment.')));
        expect(note, isNot(contains('payment.')));
        expect(secure.trim(), isNotEmpty);
      });
    }
  });
}
