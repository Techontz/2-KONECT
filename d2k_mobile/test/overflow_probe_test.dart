// Diagnostic probe: renders the product page across every supported width and
// prints the *creator* of any overflowing RenderFlex.
//
// The normal viewport test asserts `takeException() == null`, which tells you
// that something overflowed but not what. This installs its own error handler
// so the widget's creation stack survives, which is the only reliable way to
// find the offending Row without guessing at font sizes.

import 'package:d2k_mobile/app.dart';
import 'package:d2k_mobile/widgets/product_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_backend.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const viewports = <String, double>{
    '320': 320,
    '360': 360,
    '375': 375,
    '390': 390,
    '412': 412,
    '414': 414,
  };

  viewports.forEach((label, width) {
    testWidgets('probe product page at $label', (tester) async {
      final reports = <String>[];

      final previous = FlutterError.onError;
      FlutterError.onError = (FlutterErrorDetails details) {
        final summary = details.exception.toString();
        if (!summary.contains('overflowed')) {
          previous?.call(details);
          return;
        }

        // `debugCreator` carries the element that built the render object,
        // including the file and line of the widget that made it.
        final creator = details.informationCollector
            ?.call()
            .map((n) => n.toStringDeep())
            .join('\n');

        reports.add('OVERFLOW@$label :: $summary\n${creator ?? "(no creator)"}');
      };

      SharedPreferences.setMockInitialValues({
        'd2k.language': 'en',
        'd2k.onboarded': true,
      });

      tester.view.physicalSize = Size(width, 900) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(D2KApp(api: FakeBackend().client()));
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(seconds: 1));

      // Home already lists real product cards; opening one from there avoids
      // the fragile category navigation and gets us to the page under test.
      final card = find.byType(ProductCard);
      if (card.evaluate().isEmpty) {
        // ignore: avoid_print
        print('PROBE $label -> no product card on home');
        FlutterError.onError = previous;
        return;
      }
      await tester.tap(card.first, warnIfMissed: false);
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 2));

      // Scroll the whole page so sections below the fold are laid out too.
      for (var i = 0; i < 8; i++) {
        await tester.drag(
          find.byType(CustomScrollView).last,
          const Offset(0, -500),
        );
        await tester.pump(const Duration(milliseconds: 120));
      }

      FlutterError.onError = previous;
      tester.takeException();

      // The error text says *that* a RenderFlex overflowed but not which one.
      // Walking the tree and comparing the children's laid-out extent against
      // the parent's own width identifies it, and `debugCreator` carries the
      // widget chain that built it.
      for (final ro in tester.allRenderObjects) {
        if (ro is! RenderFlex) continue;
        if (ro.direction != Axis.horizontal) continue;
        if (!ro.hasSize) continue;

        var used = 0.0;
        RenderBox? child = ro.firstChild;
        while (child != null) {
          if (child.hasSize) used += child.size.width;
          final parentData = child.parentData! as FlexParentData;
          child = parentData.nextSibling;
        }

        if (used > ro.size.width + 0.01) {
          final creator = ro.debugCreator;
          final chain = creator is DebugCreator
              ? creator.element.debugGetCreatorChain(14)
              : '$creator';
          // The children's own widths say which one refuses to shrink.
          final widths = <String>[];
          RenderBox? c = ro.firstChild;
          while (c != null) {
            widths.add(c.hasSize ? c.size.width.toStringAsFixed(0) : '?');
            c = (c.parentData! as FlexParentData).nextSibling;
          }
          // ignore: avoid_print
          print('CULPRIT@$label over=${(used - ro.size.width).toStringAsFixed(2)} '
              'box=${ro.size.width.toStringAsFixed(1)} kids=[${widths.join(",")}] :: $chain');
        }
      }

      // ignore: avoid_print
      print('PROBE $label -> ${reports.length} overflow(s)');
    });
  });
}
