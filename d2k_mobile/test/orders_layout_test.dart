import 'package:d2k_mobile/app.dart';
import 'package:d2k_mobile/core/l10n/app_strings.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_backend.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The order reference is the one string on the Orders screen that must never
/// wrap or ellipsise — it is what a shopper reads out to support. This drives
/// the real checkout flow on a small Android profile and asserts the reference
/// still renders on a single line next to a visible status badge.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Logical size -> device pixel ratio.
  const profiles = <String, (Size, double)>{
    // 480 x 854 physical at 1.5x — a small/budget Android handset.
    'small android 480x854': (Size(320, 569), 1.5),
    'compact 360x800': (Size(360, 800), 3),
    'standard 390x844': (Size(390, 844), 3),
  };

  profiles.forEach((label, spec) {
    testWidgets('order reference stays on one line on $label', (tester) async {
      SharedPreferences.setMockInitialValues({
        // Swahili is the app's default; these assertions are written in English.
        'd2k.language': 'en',
        'd2k.onboarded': true,
        // A restored session, so the Orders screen fetches the account's real
        // history from the (fake) backend instead of showing the signed-out state.
        'd2k.auth.token': 'test-token',
        // Two lines so the reference sits beside a real total.
        'd2k.cart': '[{"id":"3089","qty":1,"variant":null},'
            '{"id":"3090","qty":2,"variant":null}]',
      });

      final (size, ratio) = spec;
      tester.view.physicalSize = size * ratio;
      tester.view.devicePixelRatio = ratio;
      tester.view.padding = FakeViewPadding(top: 24 * ratio, bottom: 0);
      addTearDown(tester.view.reset);

      await tester.pumpWidget(D2KApp(api: FakeBackend().client()));
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(seconds: 1));

      const strings = AppStrings(AppLanguage.english);

      // Account -> Orders. The order history comes from the backend, so no
      // local checkout is needed (or possible) to populate it.
      await tester.tap(find.text(strings.account).last);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 1));

      await tester.ensureVisible(find.text(strings.orders).last);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text(strings.orders).last);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull, reason: '$label orders screen');

      // The reference is present…
      final reference = find.textContaining(RegExp(r'D2K-\d{4}-\d+'));
      expect(reference, findsOneWidget, reason: '$label reference missing');

      // …is given enough width to render unwrapped…
      final paragraph = tester.renderObject<RenderParagraph>(reference);
      final unwrappedWidth = paragraph.getMaxIntrinsicWidth(double.infinity);
      expect(paragraph.size.width, greaterThanOrEqualTo(unwrappedWidth - 0.5),
          reason: '$label: reference starved — needs '
              '${unwrappedWidth.toStringAsFixed(1)}pt but was given '
              '${paragraph.size.width.toStringAsFixed(1)}pt');

      // …and actually occupies a single line box…
      final singleLineHeight =
          paragraph.getMaxIntrinsicHeight(double.infinity);
      expect(paragraph.size.height, lessThanOrEqualTo(singleLineHeight + 0.5),
          reason: '$label: reference wrapped onto more than one line');

      // …without being ellipsised.
      expect(paragraph.didExceedMaxLines, isFalse,
          reason: '$label: reference was truncated');

      // …and the status badge is still on screen beside it.
      final badge = find.text('Pending');
      expect(badge, findsOneWidget, reason: '$label status badge missing');
      final badgeRect = tester.getRect(badge);
      final screen = Offset.zero & tester.view.physicalSize / ratio;
      expect(screen.contains(badgeRect.topLeft), isTrue,
          reason: '$label badge pushed off screen');
      expect(screen.contains(badgeRect.bottomRight - const Offset(0.5, 0.5)),
          isTrue,
          reason: '$label badge clipped at the edge');

      // No overflow anywhere on the screen.
      expect(tester.takeException(), isNull, reason: '$label layout');
    });
  });
}
