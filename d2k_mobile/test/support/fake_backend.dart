import 'dart:convert';

import 'package:d2k_mobile/data/api_client.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// A stand-in for the Laravel API, shaped exactly like the real one.
///
/// This exists so widget tests can drive the app without a live server. It is
/// test-only scaffolding: the application itself has no bundled catalogue and
/// never falls back to canned data at runtime.
///
/// The payloads mirror the real `/shop/*` responses field for field, so a
/// contract change that would break the app also breaks these tests.
class FakeBackend {
  FakeBackend({this.failEverything = false});

  /// Drives the offline/error paths.
  final bool failEverything;

  final List<String> requestedPaths = [];

  ApiClient client() => ApiClient(
        baseUrl: 'http://test.local/api',
        client: MockClient(_handle),
      );

  Future<http.Response> _handle(http.Request request) async {
    final path = request.url.path.replaceFirst('/api', '');
    requestedPaths.add(path);

    if (failEverything) {
      return http.Response(
        jsonEncode({'message': 'Service unavailable'}),
        503,
        headers: {'content-type': 'application/json'},
      );
    }

    final body = switch (path) {
      '/shop/home' => _home,
      '/shop/categories' => {'categories': [_category]},
      '/shop/products' => {
          'products': _products,
          'meta': {
            'total': _products.length,
            'per_page': 24,
            'current_page': 1,
            'last_page': 1,
            'has_more': false,
          },
        },
      '/shop/products/suggest' => {'suggestions': <String>['Kariakoo speaker']},
      '/shop/vendors' => {'vendors': [_vendor]},
      // Writes echo the saved row back, exactly as the API does.
      '/shop/addresses' => request.method == 'POST'
          ? {'address': _address}
          : {'addresses': [_address]},
      '/shop/orders' => {'orders': [_order]},
      '/shop/chat/threads' => {'threads': <Object>[]},
      '/shop/chat/unread' => {'unread': 0},
      '/me' => {'user': _user},
      _ => path.startsWith('/shop/addresses/')
          ? {'address': _address}
          : path.startsWith('/shop/products/')
          ? {'product': _products.first}
          : path.startsWith('/shop/chat/')
              ? {'messages': <Object>[]}
              : <String, Object>{},
    };

    return http.Response(
      jsonEncode(body),
      200,
      headers: {'content-type': 'application/json'},
    );
  }

  // --------------------------------------------------------------- payloads

  static const _vendor = {
    'id': 7,
    'user_id': 42,
    'name': 'Kariakoo Electronics',
    'logo': '',
    'phone': '+255712000111',
    'phone_display': '+255 712 000 111',
    'whatsapp': '255712000111',
    'location': 'Kariakoo, Dar es Salaam',
    'website': null,
    'about': 'Electronics trader on Msimbazi Street.',
    'is_approved': true,
    // Deliberately approved but NOT verified: the badge must not appear.
    'is_verified': false,
    'member_since': 'Jan 2024',
  };

  static const _category = {
    'id': 3,
    'name': 'Electronics',
    'image': '',
    'subcategories': [
      {'id': 12, 'name': 'Speakers', 'image': ''},
    ],
  };

  static const _products = [
    {
      'id': 3089,
      'name': 'Bluetooth Speaker 20W',
      'short_description': 'Portable speaker with deep bass',
      'description': 'A rugged portable speaker sold in Kariakoo.',
      'image': '',
      'images': <String>[],
      'price': {
        'currency': 'TZS',
        'current': 45000,
        'was': 60000,
        'discount_percent': 25,
      },
      'stock': 12,
      'in_stock': true,
      'category': {'id': 3, 'name': 'Electronics'},
      'subcategory': {'id': 12, 'name': 'Speakers'},
      'vendor': _vendor,
      'specifications': [
        {'label': 'Colour', 'value': 'Black'},
        {'label': 'Condition', 'value': 'Brand new'},
      ],
      'rating': {'average': 4.6, 'count': 8, 'distribution': <Object>[]},
      'reviews': <Object>[],
    },
    {
      'id': 3090,
      'name': 'Wireless Earbuds',
      'short_description': '',
      // No description at all: the empty state must be shown, not invented copy.
      'description': '',
      'image': '',
      'images': <String>[],
      'price': {
        'currency': 'TZS',
        'current': 25000,
        'was': null,
        'discount_percent': 0,
      },
      'stock': 0,
      'in_stock': false,
      'category': {'id': 3, 'name': 'Electronics'},
      'subcategory': {'id': 12, 'name': 'Speakers'},
      'vendor': _vendor,
      'specifications': <Object>[],
      'rating': {'average': 0, 'count': 0, 'distribution': <Object>[]},
      'reviews': <Object>[],
    },
  ];

  static const _home = {
    'hero': [
      {
        'id': 1,
        'title': 'Kariakoo deals',
        'subtitle': 'Up to 40% off',
        'cta_label': 'Shop now',
        'link': '/category?id=3',
        'image': '',
        'mobile_image': '',
        'alt': 'Deals',
      },
    ],
    'hero_side': null,
    'promos': <Object>[],
    'categories': [_category],
    'collections': <Object>[],
    'shelves': [
      {'id': 'bestsellers', 'title': 'Bestsellers', 'products': _products},
    ],
    'deals': _products,
    'banners': <Object>[],
  };

  static const _address = {
    'id': 5,
    'full_name': 'Asha Juma',
    'phone': '+255712000222',
    'region': 'Dar es Salaam',
    'city': 'Dar es Salaam',
    'district': 'Kariakoo',
    'street': 'Msimbazi Street',
    'details': 'Shop 42',
    'latitude': -6.82,
    'longitude': 39.27,
    'is_default': true,
    'formatted': 'Msimbazi Street, Shop 42, Kariakoo, Dar es Salaam',
  };

  static const _order = {
    'reference': 'D2K-2026-0001',
    'status': 'pending',
    'placed_at': '2026-08-01T10:00:00+03:00',
    'item_count': 1,
    'subtotal': 45000,
    'delivery_fee': 3000,
    'total': 48000,
    'currency': 'TZS',
    'payment_method': 'cash_on_delivery',
    'delivery_address': 'Msimbazi Street, Kariakoo',
    'customer_phone': '+255712000222',
    'items': [
      {
        'id': 1,
        'product': {'id': 3089, 'name': 'Bluetooth Speaker 20W', 'image': ''},
        'vendor': 'Kariakoo Electronics',
        'quantity': 1,
        'price': 45000,
        'total': 45000,
        'status': 'pending',
      },
    ],
  };

  static const _user = {
    'id': 42,
    'name': 'Asha Juma',
    'email': 'asha@example.com',
    'phone': '+255712000222',
    'role': 'user',
  };
}
