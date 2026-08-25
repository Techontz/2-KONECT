import 'package:app_2konect/core/format.dart';
import 'package:app_2konect/models/cart.dart';
import 'package:app_2konect/models/common.dart';
import 'package:app_2konect/models/product.dart';
import 'package:app_2konect/services/catalog_service.dart';
import 'package:flutter_test/flutter_test.dart';

ProductCardModel _product({
  int id = 1,
  Availability availability = Availability.local,
  double price = 100000,
}) =>
    ProductCardModel(
      id: id,
      name: 'Product $id',
      price: Price(currency: 'TZS', current: price),
      rating: Rating.none,
      stock: 5,
      inStock: true,
      sourcing: availability == Availability.local
          ? Sourcing.localFallback
          : const Sourcing(
              type: Availability.import,
              label: 'Order from abroad',
              headline: 'Sourced from China',
              summary: 'We buy it, import it and deliver it to you.',
              leadTime: LeadTime(min: 7, max: 14, label: '7–14 days'),
            ),
      badges: ProductBadges.none,
    );

void main() {
  group('a line knows where IT is sourced from, not just the product', () {
    test('a local product bought through an imported offer is an import', () {
      // The subtle case the backend also has to get right: the product row
      // says "in Tanzania", but the offer the shopper actually chose is one
      // 2KONECT would import. The line — and therefore the order — is prepaid.
      final line = CartLine(
        product: _product(),
        quantity: 1,
        option: const BuyingOption(
          id: 42,
          price: Price(currency: 'TZS', current: 80000),
          stock: 0,
          inStock: false,
          seller: 'Overseas supplier',
          sourcing: Sourcing(
            type: Availability.import,
            label: 'Order from abroad',
            headline: 'Sourced from China',
            summary: '',
            leadTime: LeadTime(min: 7, max: 14, label: '7–14 days'),
          ),
        ),
      );

      expect(line.product.sourcing.isLocal, isTrue);
      expect(line.isImport, isTrue, reason: 'the chosen offer decides, not the product row');
    });

    test('with no offer chosen the product’s own sourcing stands', () {
      expect(CartLine(product: _product(), quantity: 1).isImport, isFalse);
      expect(
        CartLine(product: _product(availability: Availability.import), quantity: 1).isImport,
        isTrue,
      );
    });
  });

  group('cart line identity', () {
    test('the same product bought two ways is two lines', () {
      final own = CartLine(product: _product(), quantity: 1);
      final viaOffer = CartLine(
        product: _product(),
        quantity: 1,
        option: const BuyingOption(
          id: 42,
          price: Price(currency: 'TZS', current: 80000),
          stock: 3,
          inStock: true,
          seller: 'Other',
          sourcing: Sourcing.localFallback,
        ),
      );
      expect(own.key, isNot(equals(viaOffer.key)));
    });

    test('two variants of one product are two lines', () {
      final small = CartLine(product: _product(), quantity: 1, variantId: 7);
      final large = CartLine(product: _product(), quantity: 1, variantId: 8);
      expect(small.key, isNot(equals(large.key)));
    });

    test('a line survives being written to storage and read back', () {
      final line = CartLine(
        product: _product(availability: Availability.import),
        quantity: 3,
        variantId: 9,
        variantLabel: 'Colour: Black',
      );
      final restored = CartLine.fromJson(line.toJson());

      expect(restored.key, line.key);
      expect(restored.quantity, 3);
      expect(restored.variantLabel, 'Colour: Black');
      expect(restored.isImport, isTrue);
    });

    test('the order payload carries ids, never prices', () {
      final payload = CartLine(product: _product(), quantity: 2, variantId: 9).toOrderItem();
      expect(payload.keys, containsAll(['product_id', 'quantity', 'variant_id']));
      expect(payload.containsKey('price'), isFalse);
      expect(payload.containsKey('total'), isFalse);
    });
  });

  group('product query', () {
    test('sends prices as plain numbers, never formatted strings', () {
      final params = const ProductQuery(maxPrice: 1500000).toParams();
      expect(params['max_price'], 1500000);
      expect(params['max_price'], isA<num>());
      expect(params['max_price'].toString(), isNot(contains(',')));
      expect(params['max_price'].toString(), isNot(contains('TZS')));
    });

    test('a fractional cap keeps its precision rather than being rounded away', () {
      expect(const ProductQuery(maxPrice: 1500.5).toParams()['max_price'], 1500.5);
    });

    test('the screen’s own scope is not counted as an applied filter', () {
      const query = ProductQuery(availability: Availability.import, onSale: true);
      // On the "From abroad" screen, being an import is the screen, not a filter.
      expect(query.appliedCount(scopedAvailability: Availability.import), 1);
      // Reached from anywhere else, it is a filter the shopper chose.
      expect(query.appliedCount(), 2);
    });

    test('two queries differing only by page are different requests', () {
      const a = ProductQuery(q: 'phone');
      final b = a.copyWith(page: 2);
      expect(a == b, isFalse);
      expect(a.cacheKey, isNot(equals(b.cacheKey)));
    });

    test('copyWith can clear a filter, not only change it', () {
      const query = ProductQuery(maxPrice: 900000, subcategoryId: 60);
      final cleared = query.copyWith(maxPrice: null);
      expect(cleared.maxPrice, isNull);
      // …without disturbing anything else.
      expect(cleared.subcategoryId, 60);
    });
  });

  group('money', () {
    test('shillings are quoted whole', () {
      expect(Money.format(1500000), 'TZS 1,500,000');
      expect(Money.format(7000), 'TZS 7,000');
    });

    test('compact form is exact, never an approximation', () {
      expect(Money.compact(2500000), '2.5M');
      expect(Money.compact(1000000), '1M');
      expect(Money.compact(250000), '250K');
      // 1,234,567 cannot be said in one decimal without lying, so it is not.
      expect(Money.compact(1234567), '1,234,567');
    });

    test('reads a figure a customer typed, however they typed it', () {
      expect(Money.parse('1,500,000'), 1500000);
      expect(Money.parse('TZS 1 500 000'), 1500000);
      expect(Money.parse(''), isNull);
      expect(Money.parse('abc'), isNull);
    });
  });
}
