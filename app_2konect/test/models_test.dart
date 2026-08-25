import 'dart:convert';
import 'dart:io';

import 'package:app_2konect/models/catalog.dart';
import 'package:app_2konect/models/common.dart';
import 'package:app_2konect/models/payment.dart';
import 'package:app_2konect/models/product.dart';
import 'package:flutter_test/flutter_test.dart';

/// Parsed against payloads captured from the **live production API**
/// (api.2konect.shop), not hand-written fixtures. A model that parses a
/// fixture somebody invented proves nothing; these prove the app can read what
/// the server actually sends today.
Map<String, dynamic> _fixture(String name) =>
    jsonDecode(File('test/fixtures/$name.json').readAsStringSync()) as Map<String, dynamic>;

void main() {
  group('home feed (production payload)', () {
    late HomeFeed feed;

    setUpAll(() => feed = HomeFeed.fromJson(_fixture('home')));

    test('parses every section', () {
      expect(feed.hero, isNotEmpty);
      expect(feed.categories, isNotEmpty);
      expect(feed.deals, isNotEmpty);
      expect(feed.verified, isNotEmpty);
      expect(feed.shelves, isNotEmpty);
      expect(feed.isEmpty, isFalse);
    });

    test('separates local stock from imports', () {
      expect(feed.local.every((p) => p.sourcing.isLocal), isTrue);
      expect(feed.imports.every((p) => p.sourcing.isImport), isTrue);
    });

    test('keeps prices numeric and carries the currency', () {
      final product = feed.local.first;
      expect(product.price.current, isA<double>());
      expect(product.price.current, greaterThan(0));
      expect(product.price.currency, 'TZS');
    });

    test('reads the delivery-window facet as day counts', () {
      // The server sends `{"3": 2441, "10": 2511}` — string keys that only
      // mean anything once parsed back to a number of days.
      expect(feed.deliveryWindows, isNotEmpty);
      expect(feed.deliveryWindows.keys.every((days) => days > 0), isTrue);
    });
  });

  group('product detail (production payload)', () {
    late ProductPage page;

    setUpAll(() => page = ProductPage.fromJson(_fixture('product')));

    test('parses the product and its buying options', () {
      expect(page.product.id, greaterThan(0));
      expect(page.product.name, isNotEmpty);
      expect(page.product.buyingOptions, isNotEmpty);
    });

    test('gallery is primary-first and free of duplicates', () {
      final gallery = page.product.gallery;
      expect(gallery.first, page.product.image);
      expect(gallery.toSet().length, gallery.length);
    });

    test('toCard() round-trips the facts a card needs', () {
      final card = page.product.toCard();
      expect(card.id, page.product.id);
      expect(card.price.current, page.product.price.current);
      expect(card.sourcing.type, page.product.sourcing.type);
    });
  });

  group('listing facets (production payload)', () {
    late ProductListing listing;

    setUpAll(() => listing = ProductListing.fromJson(_fixture('listing')));

    test('the price ceiling comes from the catalogue, not from the app', () {
      expect(listing.filters.price.isUsable, isTrue);
      expect(listing.filters.price.max, greaterThan(listing.filters.price.min));
    });

    test('availability facets cover both ways to buy', () {
      final values = listing.filters.availability.map((f) => f.value).toSet();
      expect(values.contains(Availability.local), isTrue);
      expect(values.contains(Availability.import), isTrue);
    });

    test('paging metadata is honest about there being more', () {
      expect(listing.meta.total, greaterThan(listing.products.length));
      expect(listing.meta.hasMore, isTrue);
    });
  });

  group('categories (production payload)', () {
    test('parses the tree with its subcategories', () {
      final raw = _fixture('categories')['categories'] as List;
      final categories =
          raw.map((e) => Category.fromJson((e as Map).cast<String, dynamic>())).toList();
      expect(categories, isNotEmpty);
      expect(categories.any((c) => c.subcategories.isNotEmpty), isTrue);
    });
  });

  group('tolerant parsing', () {
    test('survives an integer arriving as a string', () {
      final product = ProductCardModel.fromJson({
        'id': '42',
        'name': 'Test',
        'price': {'currency': 'TZS', 'current': '1500000', 'was': null},
        'stock': '3',
        'in_stock': 1,
      });
      expect(product.id, 42);
      expect(product.price.current, 1500000);
      expect(product.stock, 3);
      expect(product.inStock, isTrue);
    });

    test('a payload with no sourcing block still renders as local', () {
      final product = ProductCardModel.fromJson({'id': 1, 'name': 'x'});
      expect(product.sourcing.isLocal, isTrue);
    });
  });

  group('payment options', () {
    test('a local basket may pay cash on delivery', () {
      final options = PaymentOptions.fromJson(_fixture('payment_channels_local'));
      expect(options.requiresPrepayment, isFalse);
      expect(options.cashOnDelivery, isTrue);
      expect(options.chargesDelivery, isTrue);
    });

    test('an import basket may NOT pay cash on delivery', () {
      final options = PaymentOptions.fromJson(_fixture('payment_channels_import'));
      expect(options.requiresPrepayment, isTrue);
      expect(options.cashOnDelivery, isFalse);
      // Delivery is arranged separately once it lands, so no fee at checkout.
      expect(options.chargesDelivery, isFalse);
    });

    test('an import basket with no configured channel cannot be paid at all', () {
      final options = PaymentOptions.fromJson(_fixture('payment_channels_import'));
      // This is production's real state today: no channel switched on.
      expect(options.channels, isEmpty);
      expect(options.hasNoWayToPay, isTrue);
    });

    test('the till number is only ever read from the server', () {
      final options = PaymentOptions.fromJson({
        'requires_prepayment': true,
        'cash_on_delivery': false,
        'charges_delivery': false,
        'channels': [
          {
            'code': 'lipa_namba',
            'label': 'Lipa Namba',
            'merchant_name': '2KONECT',
            'number': '555123',
            'requires_reference': true,
            'requires_verification': true,
          },
        ],
      });
      expect(options.hasNoWayToPay, isFalse);
      expect(options.channels.single.number, '555123');
    });
  });

  group('payment status', () {
    test('is a separate axis from order status', () {
      expect(PaymentStatus.parse('not_required'), PaymentStatus.notRequired);
      expect(PaymentStatus.parse('awaiting_verification'),
          PaymentStatus.awaitingVerification);
      expect(PaymentStatus.parse('verified'), PaymentStatus.verified);
      expect(PaymentStatus.parse('rejected'), PaymentStatus.rejected);
      expect(PaymentStatus.parse('anything else'), PaymentStatus.awaitingPayment);
    });

    test('only awaiting-payment and rejected still need money', () {
      expect(PaymentStatus.awaitingPayment.needsPayment, isTrue);
      expect(PaymentStatus.rejected.needsPayment, isTrue);
      expect(PaymentStatus.awaitingVerification.needsPayment, isFalse);
      expect(PaymentStatus.verified.needsPayment, isFalse);
    });

    test('awaiting verification is NOT settled', () {
      // Submitting a reference is a queue, not a payment.
      expect(PaymentStatus.awaitingVerification.isSettled, isFalse);
      expect(PaymentStatus.verified.isSettled, isTrue);
      expect(PaymentStatus.notRequired.isSettled, isTrue);
    });
  });
}
