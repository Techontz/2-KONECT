import 'dart:convert';

import 'package:d2k_mobile/data/api_client.dart';
import 'package:d2k_mobile/data/remote_catalog_source.dart';
import 'package:d2k_mobile/state/auth_controller.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The app and the backend have to agree on the wire format. These tests pin
/// the mapping against payloads shaped exactly like the live API's, so a
/// contract change fails here rather than silently blanking a screen.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({
        // Swahili is the app's default; these assertions are written in English.
        'd2k.language': 'en',}));

  ApiClient clientReturning(Map<String, dynamic> body, {int status = 200}) {
    return ApiClient(
      baseUrl: 'http://test.local/api',
      client: MockClient((_) async => http.Response(
            jsonEncode(body),
            status,
            headers: {'content-type': 'application/json'},
          )),
    );
  }

  group('product mapping', () {
    // Mirrors ProductCardResource / ProductDetailResource.
    final productJson = {
      'id': 42,
      'name': 'Samsung Galaxy A55',
      'description': 'A real handset',
      'image': 'http://test.local/storage/products/a.jpg',
      'images': [
        'http://test.local/storage/products/a.jpg',
        'http://test.local/storage/products/b.jpg',
      ],
      'price': {
        'currency': 'TZS',
        'current': 80000,
        'was': 100000,
        'discount_percent': 20,
      },
      'rating': {'average': 4.6, 'count': 12},
      'stock': 3,
      'in_stock': true,
      'category': {'id': 8, 'name': 'Electronics'},
      'subcategory': {'id': 33, 'name': 'Phones'},
      'vendor': {'id': 2, 'name': 'Kariakoo Mobile Hub'},
      'badges': {'low_stock': true, 'out_of_stock': false, 'discounted': true},
    };

    test('maps every field the cards and PDP render', () async {
      final source = RemoteCatalogSource(
        clientReturning({'products': [productJson], 'meta': {'total': 1, 'current_page': 1, 'has_more': false}}),
      );

      final listing = await source.products();
      final product = listing.products.single;

      expect(product.id, '42');
      expect(product.title, 'Samsung Galaxy A55');
      expect(product.priceBase, 80000);
      expect(product.originalPriceBase, 100000);
      expect(product.discountPercent, 20);
      expect(product.rating, 4.6);
      expect(product.reviewCount, 12);
      expect(product.stock, 3);
      expect(product.images, hasLength(2));
      expect(product.sellerName, 'Kariakoo Mobile Hub');
      expect(product.categoryId, '8');
    });

    test('prices stay in the base currency the API reports', () async {
      final source = RemoteCatalogSource(
        clientReturning({'products': [productJson], 'meta': {}}),
      );

      final product = (await source.products()).products.single;

      // The API prices in TZS; the app must not pre-convert on the way in,
      // or the currency switcher would double-apply the rate.
      expect(product.priceBase, 80000);
      expect(product.price.baseAmount, 80000);
    });

    test('a product with no images does not throw', () async {
      final bare = Map<String, dynamic>.from(productJson)
        ..['images'] = <String>[]
        ..['image'] = null;

      final source = RemoteCatalogSource(
        clientReturning({'products': [bare], 'meta': {}}),
      );

      final product = (await source.products()).products.single;
      expect(product.images, isEmpty);
    });

    test('low stock surfaces as a flash-sale count', () async {
      final source = RemoteCatalogSource(
        clientReturning({'products': [productJson], 'meta': {}}),
      );

      final product = (await source.products()).products.single;
      expect(product.flashSaleUnitsLeft, 3);
    });
  });

  group('home feed mapping', () {
    test('reads banners, categories, shelves and deals', () async {
      final source = RemoteCatalogSource(clientReturning({
        'banners': [
          {'id': 1, 'image': 'http://test.local/storage/banners/a.jpg'},
        ],
        'categories': [
          {'id': 8, 'name': 'Electronics ', 'image': null, 'product_count': 10},
        ],
        'shelves': [
          {'id': 8, 'title': 'Electronics', 'products': []},
        ],
        'deals': [],
      }));

      final feed = await source.home();

      expect(feed.banners, hasLength(1));
      // Category names in the database carry stray whitespace.
      expect(feed.categories.single.name, 'Electronics');
      expect(feed.shelves.single.title, 'Electronics');
    });
  });

  group('auth', () {
    test('maps a vendor account including approval state', () {
      final user = AuthUser.fromJson({
        'id': 7,
        'name': 'Seller',
        'email': 'seller@test.local',
        'role': 'vendor',
        'vendor': {'id': 2, 'business_name': 'Kariakoo Mobile Hub', 'is_approved': 1},
      });

      expect(user.role, AccountRole.vendor);
      expect(user.isVendor, isTrue);
      expect(user.businessName, 'Kariakoo Mobile Hub');
      // The column is a tinyint, so 1 must read as true.
      expect(user.vendorApproved, isTrue);
    });

    test('defaults an unknown role to customer', () {
      final user = AuthUser.fromJson({'id': 1, 'name': 'X', 'email': 'x@y.z'});
      expect(user.role, AccountRole.customer);
      expect(user.isVendor, isFalse);
    });
  });

  group('error handling', () {
    test('a 401 clears the stored token so the app falls back to guest', () async {
      final api = ApiClient(
        baseUrl: 'http://test.local/api',
        client: MockClient((_) async => http.Response(
              jsonEncode({'message': 'Unauthenticated.'}),
              401,
              headers: {'content-type': 'application/json'},
            )),
      );

      await api.setToken('stale-token');
      expect(api.isAuthenticated, isTrue);

      await expectLater(
        api.get('/shop/orders'),
        throwsA(isA<ApiException>().having((e) => e.isUnauthenticated, 'isUnauthenticated', isTrue)),
      );

      // Give the fire-and-forget clear a turn to run.
      await Future<void>.delayed(Duration.zero);
      expect(api.token, isNull);
    });

    test('surfaces the first validation error as the message', () async {
      final api = ApiClient(
        baseUrl: 'http://test.local/api',
        client: MockClient((_) async => http.Response(
              jsonEncode({
                'message': '',
                'errors': {'email': ['That email is already registered.']},
              }),
              422,
              headers: {'content-type': 'application/json'},
            )),
      );

      await expectLater(
        api.post('/register'),
        throwsA(isA<ApiException>().having(
          (e) => e.message, 'message', 'That email is already registered.')),
      );
    });
  });
}
