import 'package:d2k_mobile/core/l10n/app_strings.dart';
import 'package:d2k_mobile/screens/auth/auth_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_backend.dart';
import 'package:d2k_mobile/data/api_client.dart';
import 'package:d2k_mobile/state/auth_controller.dart';

/// Google sign-in is a customer feature.
///
/// These drive the real auth screen and assert the boundary the product
/// requires: a shopper is offered Google, a seller is not.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget harness(Widget child, ApiClient api) => MultiProvider(
        providers: [
          Provider<ApiClient>.value(value: api),
          ChangeNotifierProvider(create: (_) => AuthController(api)),
        ],
        child: MaterialApp(
          home: StringsScope(
            strings: const AppStrings(AppLanguage.english),
            child: child,
          ),
        ),
      );

  setUp(() => SharedPreferences.setMockInitialValues({'d2k.language': 'en'}));

  testWidgets('the customer auth screen offers Continue with Google',
      (tester) async {
    await tester.pumpWidget(harness(const AuthScreen(), FakeBackend().client()));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Continue with Google'), findsOneWidget);
  });

  testWidgets('the seller path does not offer Google', (tester) async {
    await tester.pumpWidget(
      harness(const AuthScreen(startAsVendor: true), FakeBackend().client()),
    );
    await tester.pump(const Duration(milliseconds: 400));

    // A seller account carries approval and publishing rights; that decision
    // stays with D2K rather than with Google.
    expect(find.text('Continue with Google'), findsNothing);
  });
}
