import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/remote_shop_source.dart';
import '../domain/models/commerce.dart';
import '../domain/models/currency.dart';
import '../domain/models/product.dart';
import '../domain/repositories/catalog_repository.dart';

class CartController extends ChangeNotifier {
  CartController(this._catalog);

  final CatalogRepository _catalog;

  static const String _prefsKey = 'd2k.cart';

  /// Orders above this TZS subtotal ship free — mirrors the promo strip copy.
  static const double freeDeliveryThresholdBase = 80000;
  static const double deliveryFeeBase = 6500;

  final Map<String, CartItem> _items = {};


  List<CartItem> get items => _items.values.toList(growable: false);
  // Order history is not cart state — it lives in the backend and is read by
  // the Orders screen, so a device that never placed an order still sees the
  // account's real history.

  bool get isEmpty => _items.isEmpty;

  int get itemCount =>
      _items.values.fold(0, (sum, item) => sum + item.quantity);

  int quantityOf(Product product, {String? variantLabel}) {
    final key = variantLabel == null
        ? product.id
        : '${product.id}::$variantLabel';
    return _items[key]?.quantity ?? 0;
  }

  Money get subtotal => _items.values
      .fold(Money.zero, (sum, item) => sum + item.lineTotal);

  Money get savings => _items.values
      .fold(Money.zero, (sum, item) => sum + item.lineSavings);

  bool get qualifiesForFreeDelivery =>
      subtotal.baseAmount >= freeDeliveryThresholdBase;

  Money get delivery => isEmpty || qualifiesForFreeDelivery
      ? Money.zero
      : const Money(deliveryFeeBase);

  Money get total => subtotal + delivery;

  Money get amountToFreeDelivery => Money(
      (freeDeliveryThresholdBase - subtotal.baseAmount).clamp(0, double.infinity));

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return;
    try {
      final decoded = jsonDecode(raw) as List<dynamic>;
      for (final entry in decoded.cast<Map<String, dynamic>>()) {
        final product = _catalog.productById(entry['id'] as String);
        if (product == null) continue;
        final item = CartItem(
          product: product,
          quantity: entry['qty'] as int,
          variantLabel: entry['variant'] as String?,
        );
        _items[item.key] = item;
      }
      notifyListeners();
    } catch (_) {
      // A corrupt cache must never block the shopper.
      await prefs.remove(_prefsKey);
    }
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _prefsKey,
      jsonEncode([
        for (final item in _items.values)
          {
            'id': item.product.id,
            'qty': item.quantity,
            'variant': item.variantLabel,
          }
      ]),
    );
  }

  void add(Product product, {int quantity = 1, String? variantLabel}) {
    final key =
        variantLabel == null ? product.id : '${product.id}::$variantLabel';
    final existing = _items[key];
    _items[key] = existing == null
        ? CartItem(
            product: product, quantity: quantity, variantLabel: variantLabel)
        : existing.copyWith(quantity: existing.quantity + quantity);
    notifyListeners();
    _persist();
  }

  void setQuantity(CartItem item, int quantity) {
    if (quantity <= 0) {
      _items.remove(item.key);
    } else {
      _items[item.key] = item.copyWith(quantity: quantity);
    }
    notifyListeners();
    _persist();
  }

  void increment(CartItem item) => setQuantity(item, item.quantity + 1);
  void decrement(CartItem item) => setQuantity(item, item.quantity - 1);

  void remove(CartItem item) {
    _items.remove(item.key);
    notifyListeners();
    _persist();
  }

  void clear() {
    _items.clear();
    notifyListeners();
    _persist();
  }

  /// Places the order with the backend and empties the cart.
  ///
  /// The server prices every line, checks stock, decrements it and mints the
  /// reference. The app used to invent a reference from a timestamp, which
  /// meant the "order" existed nowhere but on the handset — no seller ever saw
  /// it. Nothing about the total is decided here.
  Future<ShopOrder> checkout({
    required RemoteShopSource shop,
    required String address,
    required String phone,
    String paymentMethod = 'cash_on_delivery',
  }) async {
    final order = await shop.placeOrder(
      items: [
        for (final item in items)
          OrderLineRequest(productId: item.product.id, quantity: item.quantity),
      ],
      deliveryAddress: address,
      customerPhone: phone,
      paymentMethod: paymentMethod,
    );

    _items.clear();
    notifyListeners();
    _persist();
    return order;
  }
}
