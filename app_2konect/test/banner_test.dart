import 'dart:convert';
import 'dart:io';

import 'package:app_2konect/core/theme/app_theme.dart';
import 'package:app_2konect/features/home/widgets/hero_carousel.dart';
import 'package:app_2konect/models/catalog.dart';
import 'package:app_2konect/providers/core.dart';
import 'package:app_2konect/widgets/banner_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The banner regression suite.
///
/// The bug this guards against was not a layout mistake: production publishes
/// every campaign as `image/svg+xml`, and Flutter's image codecs cannot decode
/// SVG, so the whole hero rendered as an empty plate while the website — whose
/// `<img>` renders SVG natively — showed it perfectly. These assert the shape
/// of the real payload, the format decision, and that the carousel survives
/// whatever the API sends.
Map<String, dynamic> _home() =>
    jsonDecode(File('test/fixtures/home.json').readAsStringSync())
        as Map<String, dynamic>;

Future<Widget> _harness(Widget child, {Size size = const Size(412, 900)}) async {
  SharedPreferences.setMockInitialValues({});
  final preferences = await SharedPreferences.getInstance();

  return ProviderScope(
    overrides: [preferencesProvider.overrideWithValue(preferences)],
    child: MaterialApp(
      theme: AppTheme.build(),
      home: MediaQuery(
        data: MediaQueryData(size: size),
        child: Scaffold(body: child),
      ),
    ),
  );
}

void main() {
  group('1. the production payload parses', () {
    test('every banner slot is read from the live feed', () {
      final feed = HomeFeed.fromJson(_home());

      expect(feed.hero, isNotEmpty, reason: 'the hero rail must have campaigns');
      expect(feed.promos, isNotEmpty);
      expect(feed.heroSide, isNotNull);

      for (final banner in feed.hero) {
        expect(banner.id, greaterThan(0));
        expect(banner.artwork, isNotNull, reason: 'a banner with no artwork cannot render');
      }
    });

    test('title, subtitle, cta and link survive parsing', () {
      final first = HomeFeed.fromJson(_home()).hero.first;
      expect(first.title, isNotEmpty);
      expect(first.subtitle, isNotEmpty);
      expect(first.ctaLabel, isNotEmpty);
      expect(first.link, isNotEmpty);
    });
  });

  group('2. the image URL is built correctly', () {
    test('the API sends absolute URLs, so nothing needs prefixing', () {
      for (final banner in HomeFeed.fromJson(_home()).hero) {
        final url = banner.artwork!;
        expect(url, startsWith('https://'),
            reason: 'a relative path would need the storage origin prepended');
        expect(Uri.tryParse(url), isNotNull);
      }
    });

    test('mobile_image is preferred over image', () {
      const banner = HeroBanner(
        id: 1,
        image: 'https://x/desktop.png',
        mobileImage: 'https://x/phone.png',
      );
      expect(banner.artwork, 'https://x/phone.png');

      const noPhoneCrop = HeroBanner(id: 2, image: 'https://x/desktop.png');
      expect(noPhoneCrop.artwork, 'https://x/desktop.png');
    });
  });

  group('3. the format decision — the actual bug', () {
    test('every production banner is SVG, which Flutter cannot decode natively',
        () {
      final feed = HomeFeed.fromJson(_home());
      final all = [...feed.hero, ...feed.promos, feed.heroSide!];

      expect(all, isNotEmpty);
      for (final banner in all) {
        expect(
          BannerImage.isVector(banner.artwork!),
          isTrue,
          reason: '${banner.artwork} should be routed to the vector renderer',
        );
      }
    });

    test('raster URLs are routed to the raster renderer', () {
      expect(BannerImage.isVector('https://x/a.png'), isFalse);
      expect(BannerImage.isVector('https://x/a.jpg'), isFalse);
      expect(BannerImage.isVector('https://x/a.webp'), isFalse);
      expect(BannerImage.isVector('https://x/a.svg'), isTrue);
      expect(BannerImage.isVector('https://x/a.svgz'), isTrue);
      // A query string must not defeat the check.
      expect(BannerImage.isVector('https://x/a.svg?v=2'), isTrue);
      expect(BannerImage.isVector('https://x/a.png?v=2'), isFalse);
      // Case is not significant.
      expect(BannerImage.isVector('https://x/A.SVG'), isTrue);
    });
  });

  group('4. the copy layer is lifted out, not the artwork', () {
    late String artwork;

    setUpAll(() {
      artwork = File('test/fixtures/hero-deals.svg').readAsStringSync();
    });

    test('the real banner still carries its baked-in copy', () {
      expect(artwork, contains('<text'));
      expect(artwork, contains('Big deals. Better prices.'));
    });

    test('stripping removes every text element and nothing else', () {
      final stripped = BannerImage.withoutCopyLayer(artwork);

      // No drawable text survives…
      expect(stripped, isNot(contains('<text')));
      // …though the root's `aria-label` does, and should: it is the campaign's
      // accessible name, not painted content, and the renderer passes it
      // through as a semantics label rather than drawing it.
      expect(stripped, contains('aria-label="Big deals. Better prices."'));

      // …and the plate is intact: gradients, the dot pattern, the decorative
      // mark and the definitions they reference.
      expect(stripped, contains('<defs>'));
      expect(stripped, contains('linearGradient'));
      expect(stripped, contains('radialGradient'));
      expect(stripped, contains('<pattern'));
      expect(stripped, contains('<circle'));
      expect(stripped, contains('viewBox="0 0 1200 400"'));
    });

    test('unparseable artwork is returned untouched rather than blanked', () {
      const broken = '<svg><this is not xml';
      expect(BannerImage.withoutCopyLayer(broken), broken);
    });
  });

  group('5. the carousel renders', () {
    testWidgets('every real production banner renders without overflow',
        (tester) async {
      final feed = HomeFeed.fromJson(_home());
      await tester.pumpWidget(await _harness(HeroCarousel(banners: feed.hero)));
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(find.byType(HeroCarousel), findsOneWidget);
      // The copy is drawn from the API's own fields, so the headline of the
      // slide in view is on screen as real text.
      expect(find.text(feed.hero.first.title!), findsOneWidget);
    });

    testWidgets('an empty banner list renders nothing rather than a hole',
        (tester) async {
      await tester.pumpWidget(await _harness(const HeroCarousel(banners: [])));
      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.byType(SizedBox), findsWidgets);
    });

    testWidgets('a banner with no artwork still renders its copy', (tester) async {
      await tester.pumpWidget(await _harness(
        const HeroCarousel(
          banners: [HeroBanner(id: 1, title: 'No picture', subtitle: 'Still readable')],
        ),
      ));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('holds the authored 1200/400 aspect', (tester) async {
      final feed = HomeFeed.fromJson(_home());
      await tester.pumpWidget(await _harness(HeroCarousel(banners: feed.hero)));
      await tester.pump();

      final box = tester.getRect(find.byType(HeroCarousel));
      final expected = (412 * 0.93 - 8) / HeroCarousel.aspect;
      expect(box.height, closeTo(expected, 1.0));
    });

    testWidgets('survives every phone width without overflow', (tester) async {
      final feed = HomeFeed.fromJson(_home());

      for (final width in [320.0, 360.0, 412.0, 480.0]) {
        await tester.pumpWidget(await _harness(
          HeroCarousel(banners: feed.hero),
          size: Size(width, 900),
        ));
        await tester.pump();
        expect(tester.takeException(), isNull, reason: 'overflowed at ${width}px');
      }
    });

    testWidgets('a long headline shrinks rather than clipping', (tester) async {
      await tester.pumpWidget(await _harness(
        const HeroCarousel(
          banners: [
            HeroBanner(
              id: 1,
              title: 'An extraordinarily long campaign headline that no designer '
                  'would ever actually write but which must not break the plate',
              subtitle: 'And a supporting line that is also considerably longer '
                  'than anything the marketing team has produced so far',
              ctaLabel: 'A call to action of unusual length',
              image: 'https://x/a.svg',
            ),
          ],
        ),
        size: const Size(320, 900),
      ));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('the carousel can be swiped', (tester) async {
      final feed = HomeFeed.fromJson(_home());
      expect(feed.hero.length, greaterThan(1));

      await tester.pumpWidget(await _harness(HeroCarousel(banners: feed.hero)));
      await tester.pump();

      expect(find.text(feed.hero[0].title!), findsOneWidget);

      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      expect(find.text(feed.hero[1].title!), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
