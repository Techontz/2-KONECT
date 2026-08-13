@Tags(['live'])
library;

import 'package:d2k_mobile/data/api_client.dart';
import 'package:d2k_mobile/data/remote_catalog_source.dart';
import 'package:d2k_mobile/domain/repositories/catalog_repository.dart';
import 'package:flutter_test/flutter_test.dart';

/// Drives the app's real data layer against the running Laravel backend.
///
/// This is the check that the mobile client and the website are looking at the
/// same database — not a mock, not a fixture. Run it with the API up:
///
///   flutter test test/live_backend_test.dart --dart-define=D2K_API=...
///
/// It is tagged `live` so it can be excluded from CI where no server exists.
void main() {
  const base = String.fromEnvironment(
    'D2K_API',
    defaultValue: 'http://127.0.0.1:8000/api',
  );

  late CatalogRepository catalog;

  setUp(() {
    final api = ApiClient(baseUrl: base);
    catalog = CatalogRepository(RemoteCatalogSource(api));
  });

  test('home feed comes from the real backend', () async {
    final feed = await catalog.home();

    expect(feed.categories, isNotEmpty, reason: 'no categories from the API');
    expect(
      feed.deals.isNotEmpty || feed.shelves.isNotEmpty,
      isTrue,
      reason: 'the home feed returned no products at all',
    );

    for (final category in feed.categories) {
      expect(category.id, isNotEmpty);
      expect(category.name, isNotEmpty);
    }
  });

  test('the catalogue is the real one, not a bundled sample', () async {
    final page = await catalog.list(perPage: 5);

    expect(page.products, isNotEmpty);
    // The real D2K catalogue is thousands of rows; a bundled sample was ~100.
    expect(page.total, greaterThan(1000),
        reason: 'total ${page.total} looks like sample data, not the catalogue');

    for (final product in page.products) {
      expect(product.id, isNotEmpty);
      expect(product.title, isNotEmpty);
      expect(product.priceBase, greaterThan(0));
    }
  });

  test('product detail carries description, specs and a real vendor', () async {
    final page = await catalog.list(perPage: 12);
    final detail = await catalog.product(page.products.first.id);

    expect(detail.title, isNotEmpty);
    expect(detail.vendor, isNotNull, reason: 'no vendor on the product');
    expect(detail.vendor!.name, isNotEmpty);

    // Description and specifications are separate concepts and must stay so.
    expect(detail.description, isNot(contains('specification')));

    // Verification is an admin decision that arrives from the server. It must
    // never be inferred from a store merely being approved to sell.
    final vendor = detail.vendor!;
    if (vendor.isVerified) {
      expect(vendor.isApproved, isTrue,
          reason: 'a verified store should also be approved');
    }
  });

  test('vendor contacts are only offered when usable', () async {
    final vendors = await catalog.vendors();
    expect(vendors, isNotEmpty);

    for (final vendor in vendors) {
      if (vendor.canCall) {
        expect(vendor.phone, isNotNull);
        expect(vendor.phone!.trim(), isNotEmpty);
      }
      if (vendor.canWhatsApp) {
        // wa.me needs digits only, no plus, no spaces.
        expect(vendor.whatsapp, matches(RegExp(r'^\d{9,15}$')),
            reason: '${vendor.name} has an unusable WhatsApp number');
      }
    }
  });

  test('search queries the backend', () async {
    final results = await catalog.search('phone');
    for (final product in results.take(5)) {
      expect(product.id, isNotEmpty);
      expect(product.priceBase, greaterThan(0));
    }
  });

  test('categories expose their subcategories', () async {
    final categories = await catalog.categories(refresh: true);

    expect(categories, isNotEmpty);
    expect(
      categories.any((c) => c.subcategories.isNotEmpty),
      isTrue,
      reason: 'no subcategories came back from the API',
    );
  });
}
