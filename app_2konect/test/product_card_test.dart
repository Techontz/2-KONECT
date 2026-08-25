import 'dart:convert';
import 'dart:io';

import 'package:app_2konect/core/theme/app_theme.dart';
import 'package:app_2konect/models/catalog.dart';
import 'package:app_2konect/models/common.dart' as k;
import 'package:app_2konect/models/product.dart';
import 'package:app_2konect/providers/core.dart';
import 'package:app_2konect/widgets/product_card.dart';
import 'package:app_2konect/widgets/product_grid.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The product-card acceptance pass.
///
/// A card must survive whatever the catalogue contains, not just the tidy
/// products that happen to be listed today. Every shape below is one the real
/// marketplace either already has or will have, and each is rendered at the
/// grid's own geometry — the same arithmetic the app ships — so a card that
/// overflows here would overflow on a phone.
Future<Widget> _harness(
  Widget child, {
  double width = 164,
  double textScale = 1.0,
}) async {
  SharedPreferences.setMockInitialValues({});
  final preferences = await SharedPreferences.getInstance();

  return ProviderScope(
    overrides: [preferencesProvider.overrideWithValue(preferences)],
    child: MaterialApp(
      theme: AppTheme.build(),
      home: MediaQuery(
        data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
        child: Scaffold(
          backgroundColor: Colors.white,
          body: Center(
            child: Builder(
              builder: (context) => SizedBox(
                width: width,
                height: ProductGrid.cardHeight(context, width),
                child: child,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

ProductCardModel _card({
  required String name,
  double price = 145000,
  double? was,
  int? discount,
  k.Availability availability = k.Availability.local,
  int stock = 12,
  int reviews = 0,
  double average = 0,
  String? image = 'https://api.2konect.shop/storage/products/x.jpg',
  String? vendor = '2KONECT Vendor Store',
  bool verified = true,
  bool bulk = false,
  bool priceFrom = false,
}) =>
    ProductCardModel(
      id: 1,
      name: name,
      image: image,
      price: k.Price(currency: 'TZS', current: price, was: was, discountPercent: discount),
      rating: k.Rating(average: average, count: reviews),
      stock: stock,
      inStock: stock > 0,
      vendor: vendor == null ? null : k.Ref(id: 1, name: vendor, isVerified: verified),
      sourcing: availability == k.Availability.local
          ? k.Sourcing.localFallback
          : const k.Sourcing(
              type: k.Availability.import,
              label: 'Order from abroad',
              headline: 'Sourced from China',
              summary: '',
              origin: k.Country(code: 'CN', name: 'China', flag: '🇨🇳'),
              leadTime: k.LeadTime(min: 7, max: 14, label: '7–14 days'),
            ),
      hasBulkPricing: bulk,
      priceFrom: priceFrom,
      badges: ProductBadges(
        lowStock: stock > 0 && stock <= 5,
        outOfStock: stock <= 0,
        discounted: was != null,
      ),
    );

/// Fails if Flutter reported an overflow while the widget was on screen.
void expectNoOverflow(WidgetTester tester) {
  final exception = tester.takeException();
  expect(
    exception,
    isNull,
    reason: 'the card overflowed: $exception',
  );
}

void main() {
  group('the card survives every shape the catalogue produces', () {
    final cases = <String, ProductCardModel>{
      'short name': _card(name: 'Kettle'),
      'very long name': _card(
        name: 'Premium Stainless Steel Insulated Vacuum Travel Mug With Leak-Proof Lid, 500ml',
      ),
      'cheap product': _card(name: 'Phone case', price: 7000),
      'expensive product': _card(name: 'Refrigerator', price: 5040000),
      'discounted': _card(name: 'Suitcase', price: 7000, was: 30000, discount: 77),
      'heavily discounted long name': _card(
        name: 'Large Hard-Shell Travel Suitcase With Spinner Wheels And Combination Lock',
        price: 7000,
        was: 30000,
        discount: 77,
      ),
      'local': _card(name: 'Local kettle'),
      'import': _card(name: 'Imported drone', availability: k.Availability.import),
      'import with long price': _card(
        name: 'iPhone 17 Pro Max 256GB',
        price: 2500000,
        was: 3450000,
        discount: 28,
        availability: k.Availability.import,
      ),
      'with reviews': _card(name: 'Reviewed product', reviews: 1284, average: 4.8),
      'reviews and discount and long name': _card(
        name: 'Womens Comfortable Cotton Innerwear Set Multipack Assorted Colours',
        price: 145000,
        was: 180000,
        discount: 19,
        reviews: 2411,
        average: 4.9,
      ),
      'out of stock': _card(name: 'Sold out item', stock: 0),
      'low stock': _card(name: 'Nearly gone', stock: 1),
      'import with no stock (made to order)':
          _card(name: 'Imported to order', stock: 0, availability: k.Availability.import),
      'no image': _card(name: 'Missing photograph', image: null),
      'no vendor': _card(name: 'Unattributed product', vendor: null),
      'bulk pricing': _card(name: 'Wholesale rice 25kg', bulk: true),
      'price from (variants)': _card(name: 'T-shirt', priceFrom: true),
      'everything at once': _card(
        name: 'Premium 5G Smartphone 256GB Dual SIM Unlocked International Edition',
        price: 1250000,
        was: 1405000,
        discount: 11,
        availability: k.Availability.import,
        reviews: 3172,
        average: 4.7,
        stock: 0,
        bulk: true,
        priceFrom: true,
      ),
    };

    for (final entry in cases.entries) {
      testWidgets('${entry.key} — renders without overflow', (tester) async {
        await tester.pumpWidget(await _harness(ProductCard(product: entry.value)));
        await tester.pump();
        expectNoOverflow(tester);
        expect(find.byType(ProductCard), findsOneWidget);
      });
    }

    // The worst card, at every width the grid can produce and at the largest
    // text size the app allows. This is the case that actually bites.
    final worst = cases['everything at once']!;

    for (final width in [148.0, 164.0, 180.0, 200.0, 220.0]) {
      testWidgets('the worst card fits a ${width.round()}px cell', (tester) async {
        await tester.pumpWidget(await _harness(ProductCard(product: worst), width: width));
        await tester.pump();
        expectNoOverflow(tester);
      });
    }

    for (final scale in [0.9, 1.0, 1.15, 1.3]) {
      testWidgets('the worst card fits at $scale× text', (tester) async {
        await tester.pumpWidget(
          await _harness(ProductCard(product: worst), textScale: scale),
        );
        await tester.pump();
        expectNoOverflow(tester);
      });
    }
  });

  group('every card in a row is the same height', () {
    testWidgets('a one-line name and a two-line name produce equal cards',
        (tester) async {
      SharedPreferences.setMockInitialValues({});
      final preferences = await SharedPreferences.getInstance();

      final products = [
        _card(name: 'Kettle'),
        _card(
          name: 'Premium Stainless Steel Insulated Vacuum Travel Mug 500ml',
          reviews: 44,
          average: 4.2,
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [preferencesProvider.overrideWithValue(preferences)],
          child: MaterialApp(
            theme: AppTheme.build(),
            home: Scaffold(
              body: ProductGridView(products: products),
            ),
          ),
        ),
      );
      await tester.pump();
      expectNoOverflow(tester);

      final cards = tester.widgetList<ProductCard>(find.byType(ProductCard)).toList();
      expect(cards.length, 2);

      final first = tester.getRect(find.byType(ProductCard).at(0));
      final second = tester.getRect(find.byType(ProductCard).at(1));
      expect(first.height, second.height,
          reason: 'a grid row must finish level whatever the names are');
      expect(first.width, second.width);
    });
  });

  group('against the real catalogue', () {
    testWidgets('every product on the production home feed renders cleanly',
        (tester) async {
      final json = jsonDecode(File('test/fixtures/home.json').readAsStringSync())
          as Map<String, dynamic>;
      final feed = HomeFeed.fromJson(json);

      final everything = <ProductCardModel>[
        ...feed.local,
        ...feed.imports,
        ...feed.verified,
        ...feed.deals,
        for (final shelf in feed.shelves) ...shelf.products,
      ];

      expect(everything.length, greaterThan(20),
          reason: 'the fixture should carry a real catalogue');

      for (final product in everything) {
        await tester.pumpWidget(await _harness(ProductCard(product: product)));
        await tester.pump();
        expect(
          tester.takeException(),
          isNull,
          reason: '"${product.name}" overflowed its card',
        );
      }
    });
  });
}
