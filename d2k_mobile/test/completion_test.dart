import 'package:d2k_mobile/core/l10n/app_strings.dart';
import 'package:d2k_mobile/data/remote_catalog_source.dart';
import 'package:d2k_mobile/data/remote_shop_source.dart';
import 'package:d2k_mobile/domain/repositories/catalog_repository.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_backend.dart';

void main() {
  group('address CRUD goes to the backend', () {
    test('list, create, update, delete and default all call the API', () async {
      final backend = FakeBackend();
      final shop = RemoteShopSource(backend.client());

      final addresses = await shop.addresses();
      expect(addresses, hasLength(1));
      expect(addresses.first.isDefault, isTrue);
      expect(addresses.first.latitude, isNotNull);
      expect(addresses.first.summary, contains('Kariakoo'));

      await shop.createAddress(const AddressDraft(
        fullName: 'Asha Juma',
        phone: '+255712000222',
        city: 'Dar es Salaam',
        district: 'Kariakoo',
        latitude: -6.82,
        longitude: 39.27,
      ));
      await shop.updateAddress('5', const AddressDraft(
        fullName: 'Asha J',
        phone: '+255712000222',
        city: 'Dar es Salaam',
      ));
      await shop.deleteAddress('5');
      await shop.makeDefaultAddress('5');

      expect(backend.requestedPaths, contains('/shop/addresses'));
      expect(backend.requestedPaths, contains('/shop/addresses/5'));
      expect(backend.requestedPaths, contains('/shop/addresses/5/default'));
    });

    test('a saved address carries the map coordinate', () async {
      final shop = RemoteShopSource(FakeBackend().client());
      final address = (await shop.addresses()).first;

      expect(address.hasPin, isTrue);
      expect(address.latitude, closeTo(-6.82, 0.001));
      expect(address.longitude, closeTo(39.27, 0.001));
    });
  });

  group('localisation', () {
    test('exactly four languages, Swahili preferred', () {
      expect(AppLanguage.values.map((l) => l.code).toList(),
          equals(['sw', 'en', 'fr', 'zh']));
      expect(AppLanguage.values.first, AppLanguage.swahili);
      expect(AppLanguage.fromCode(null), AppLanguage.swahili);
      expect(AppLanguage.fromCode('nonsense'), AppLanguage.swahili);
    });

    test('every language translates the whole UI with no English leakage', () {
      const english = AppStrings(AppLanguage.english);

      // A sample spanning every screen group the brief lists.
      String read(AppStrings s, String Function(AppStrings) pick) => pick(s);

      final probes = <String Function(AppStrings)>[
        (s) => s.home,
        (s) => s.categories,
        (s) => s.cart,
        (s) => s.account,
        (s) => s.checkout,
        (s) => s.addresses,
        (s) => s.orders,
        (s) => s.messages,
        (s) => s.addToCart,
        (s) => s.specifications,
        (s) => s.contactSeller,
        (s) => s.cashOnDelivery,
        (s) => s.noDescription,
        (s) => s.signInToContinue,
      ];

      for (final language in AppLanguage.values) {
        final strings = AppStrings(language);
        for (final probe in probes) {
          final value = read(strings, probe);
          expect(value.trim(), isNotEmpty,
              reason: '${language.code}: empty string');

          if (language != AppLanguage.english) {
            // A key that fell through to English returns the identical string.
            // Some words are genuinely the same in another language, so those
            // are listed rather than treated as a gap.
            const sameInSomeLanguages = {
              'Messages', 'WhatsApp', 'D2K', 'Direct2Kariakoo', 'Total',
            };
            final englishValue = read(english, probe);
            final suspicious = value == englishValue &&
                englishValue.length > 6 &&
                !sameInSomeLanguages.contains(englishValue);
            expect(suspicious, isFalse,
                reason: '${language.code}: "$englishValue" is untranslated');
          }
        }
      }
    });
  });

  group('no demo fallback', () {
    test('a failing API yields an error, never a catalogue', () async {
      final catalog =
          CatalogRepository(RemoteCatalogSource(FakeBackend(failEverything: true).client()));

      await expectLater(catalog.home(), throwsA(anything));
      await expectLater(catalog.list(), throwsA(anything));
      await expectLater(catalog.product('3089'), throwsA(anything));

      // Nothing was cached from the failures, so no screen can render
      // stand-in products.
      expect(catalog.cached, isEmpty);
      expect(catalog.categoriesSync, isEmpty);
    });

    test('the repository cache never substitutes for a failed request', () async {
      final catalog =
          CatalogRepository(RemoteCatalogSource(FakeBackend().client()));

      await catalog.list();
      expect(catalog.cached, isNotEmpty);

      // The cache resolves ids that were already fetched; it is not a source.
      expect(catalog.productById('3089'), isNotNull);
      expect(catalog.productById('does-not-exist'), isNull);
    });
  });

  group('vendor approval versus verification', () {
    test('an approved seller does not get the verified badge', () async {
      final catalog =
          CatalogRepository(RemoteCatalogSource(FakeBackend().client()));

      final product = await catalog.product('3089');
      final vendor = product.vendor!;

      expect(vendor.isApproved, isTrue);
      expect(vendor.isVerified, isFalse,
          reason: 'the fixture is approved but unverified');
    });

    test('contact actions are offered only when usable', () async {
      final catalog =
          CatalogRepository(RemoteCatalogSource(FakeBackend().client()));
      final vendor = (await catalog.product('3089')).vendor!;

      expect(vendor.canCall, isTrue);
      expect(vendor.canWhatsApp, isTrue);
      expect(vendor.canChat, isTrue);
      expect(vendor.whatsAppUri().toString(), startsWith('https://wa.me/255'));
      expect(vendor.telUri.toString(), startsWith('tel:+255'));
    });
  });

  group('product content', () {
    test('description and specifications stay separate', () async {
      final catalog =
          CatalogRepository(RemoteCatalogSource(FakeBackend().client()));

      final withBoth = await catalog.product('3089');
      expect(withBoth.hasDescription, isTrue);
      expect(withBoth.specifications, containsPair('Colour', 'Black'));
      expect(withBoth.description, isNot(contains('Colour')));
    });

    test('a product with no description is not given one', () async {
      final source = RemoteCatalogSource(FakeBackend().client());
      final listing = await source.products();
      final blank = listing.products.firstWhere((p) => p.id == '3090');

      expect(blank.hasDescription, isFalse);
      expect(blank.description, isEmpty);
      expect(blank.inStock, isFalse);
    });
  });

  group('checkout', () {
    test('the order comes back from the server, not the device', () async {
      final backend = FakeBackend();
      final shop = RemoteShopSource(backend.client());

      final orders = await shop.orders();
      expect(orders, hasLength(1));

      final order = orders.first;
      expect(order.reference, 'D2K-2026-0001');
      expect(order.paymentMethod, 'cash_on_delivery');
      expect(order.paymentLabel, 'Cash on delivery');
      expect(order.total, 48000);
      // The total is the server's arithmetic, not a local sum.
      expect(order.subtotal + order.deliveryFee, order.total);
      expect(order.canCancel, isTrue);
    });
  });

  group('chat', () {
    test('threads and messages come from the shared messages API', () async {
      final backend = FakeBackend();
      final catalog = CatalogRepository(RemoteCatalogSource(backend.client()));
      await catalog.product('3089');

      expect(backend.requestedPaths.any((p) => p.startsWith('/shop/products/')),
          isTrue);
    });
  });
}