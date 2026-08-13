import 'package:d2k_mobile/app.dart';
import 'package:d2k_mobile/core/l10n/app_strings.dart';
import 'package:d2k_mobile/screens/shell/app_shell.dart';
import 'package:d2k_mobile/widgets/product_card.dart';
import 'package:d2k_mobile/widgets/search_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_backend.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Renders every tab at a real phone viewport and fails on any layout error —
/// overflow, unbounded constraint or assertion — so a regression cannot ship
/// silently as a blank screen.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({
        // Swahili is the app's default; these assertions are written in English.
        'd2k.language': 'en','d2k.onboarded': true});
  });

  Future<void> pumpShell(WidgetTester tester) async {
    // iPhone 16 geometry, including the notch and home-indicator insets.
    tester.view.physicalSize = const Size(1179, 2556);
    tester.view.devicePixelRatio = 3;
    tester.view.padding =
        const FakeViewPadding(top: 177, bottom: 102);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(D2KApp(api: FakeBackend().client()));
    // Let the splash bootstrap complete and settle on the shell.
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(seconds: 1));
  }

  testWidgets('every tab renders without layout errors', (tester) async {
    await pumpShell(tester);
    expect(find.byType(AppShell), findsOneWidget);
    expect(tester.takeException(), isNull);

    const strings = AppStrings(AppLanguage.english);
    for (final label in [
      strings.categories,
      strings.deals,
      strings.account,
      strings.cart,
      strings.home,
    ]) {
      await tester.tap(find.text(label).last);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull, reason: 'while showing $label');
    }
  });

  testWidgets('category listing and product page render cleanly',
      (tester) async {
    await pumpShell(tester);
    const strings = AppStrings(AppLanguage.english);

    await tester.tap(find.text(strings.categories).last);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.text('Electronics').first);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.takeException(), isNull, reason: 'category listing');

    await tester.tap(find.byType(ProductCard).first, warnIfMissed: false);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.takeException(), isNull, reason: 'product page');

    for (var i = 0; i < 8; i++) {
      await tester.drag(
        find.byType(CustomScrollView).last,
        const Offset(0, -600),
        warnIfMissed: false,
      );
      await tester.pump(const Duration(milliseconds: 250));
      expect(tester.takeException(), isNull, reason: 'product scroll step $i');
    }
  });

  testWidgets('search screen renders cleanly', (tester) async {
    await pumpShell(tester);

    await tester.tap(find.byType(D2KSearchField).first);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.takeException(), isNull, reason: 'search idle');

    await tester.enterText(find.byType(TextField).first, 'iphone');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.takeException(), isNull, reason: 'search results');
  });

  testWidgets('home scrolls through the whole feed cleanly', (tester) async {
    await pumpShell(tester);

    for (var i = 0; i < 12; i++) {
      await tester.drag(
        find.byType(CustomScrollView).first,
        const Offset(0, -600),
        warnIfMissed: false,
      );
      await tester.pump(const Duration(milliseconds: 250));
      expect(tester.takeException(), isNull, reason: 'after scroll step $i');
    }
  });
}
