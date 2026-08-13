// Renders the deep commerce flow at several phone viewports and fails on any
// layout error, so a card or row that only overflows on a narrow device cannot
// reach a release build.

import 'package:d2k_mobile/app.dart';
import 'package:d2k_mobile/core/l10n/app_strings.dart';
import 'package:d2k_mobile/widgets/product_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_backend.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Logical size -> device pixel ratio, covering the narrowest Android phone
  // through to a large-screen device.
  const viewports = <String, (Size, double)>{
    '360x800': (Size(360, 800), 3),
    '375x812': (Size(375, 812), 3),
    '390x844': (Size(390, 844), 3),
    '412x915': (Size(412, 915), 2.625),
  };

  viewports.forEach((label, spec) {
    testWidgets('product flow renders cleanly at $label', (tester) async {
      SharedPreferences.setMockInitialValues({
        // Swahili is the app's default; these assertions are written in English.
        'd2k.language': 'en','d2k.onboarded': true});

      final (size, ratio) = spec;
      tester.view.physicalSize = size * ratio;
      tester.view.devicePixelRatio = ratio;
      tester.view.padding =
          FakeViewPadding(top: 47 * ratio, bottom: 34 * ratio);
      addTearDown(tester.view.reset);

      await tester.pumpWidget(D2KApp(api: FakeBackend().client()));
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull, reason: '$label home');

      const strings = AppStrings(AppLanguage.english);
      await tester.tap(find.text(strings.categories).last);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 1));

      await tester.tap(find.text('Electronics').first);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull, reason: '$label category listing');

      await tester.tap(find.byType(ProductCard).first, warnIfMissed: false);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull, reason: '$label product page');

      for (var i = 0; i < 10; i++) {
        await tester.drag(
          find.byType(CustomScrollView).last,
          const Offset(0, -600),
          warnIfMissed: false,
        );
        await tester.pump(const Duration(milliseconds: 250));
        expect(tester.takeException(), isNull,
            reason: '$label product scroll step $i');
      }
    });
  });
}
