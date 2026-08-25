import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/cart.dart';
import '../models/product.dart';
import 'core.dart';

/// The basket, held on the device and persisted across launches.
///
/// It remembers *what* was picked up. It never decides what any of it costs —
/// every figure the customer is shown at checkout comes back from
/// `/shop/cart/quote`, priced by the same code that will charge for it.
class CartController extends StateNotifier<List<CartLine>> {
  CartController(this._prefs) : super(const []) {
    _load();
  }

  final SharedPreferences _prefs;

  static const _key = '2konect.cart.v1';

  void _load() {
    final raw = _prefs.getString(_key);
    if (raw == null) return;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) return;
      state = decoded
          .whereType<Map>()
          .map((e) => CartLine.fromJson(e.cast<String, dynamic>()))
          .toList();
    } on Object {
      // A basket written by an older build that cannot be read is dropped
      // rather than crashing the launch.
      _prefs.remove(_key);
    }
  }

  void _persist() {
    _prefs.setString(_key, jsonEncode(state.map((line) => line.toJson()).toList()));
  }

  int get count => state.fold(0, (sum, line) => sum + line.quantity);

  /// True when anything in the basket is sourced from abroad — the single
  /// question that decides how this order may be paid for.
  bool get hasImport => state.any((line) => line.isImport);

  int quantityOf(int productId) => state
      .where((line) => line.product.id == productId)
      .fold(0, (sum, line) => sum + line.quantity);

  CartLine? find(String key) {
    for (final line in state) {
      if (line.key == key) return line;
    }
    return null;
  }

  void add(
    ProductCardModel product, {
    int quantity = 1,
    BuyingOption? option,
    int? variantId,
    String? variantLabel,
  }) {
    final candidate = CartLine(
      product: product,
      quantity: quantity,
      option: option,
      variantId: variantId,
      variantLabel: variantLabel,
    );

    final existing = state.indexWhere((line) => line.key == candidate.key);

    if (existing >= 0) {
      final merged = state[existing];
      state = [...state]..[existing] = merged.copyWith(
          quantity: _cap(merged.quantity + quantity, merged),
        );
    } else {
      state = [...state, candidate.copyWith(quantity: _cap(quantity, candidate))];
    }
    _persist();
  }

  void setQuantity(String key, int quantity) {
    if (quantity <= 0) return remove(key);
    final index = state.indexWhere((line) => line.key == key);
    if (index < 0) return;
    state = [...state]..[index] = state[index].copyWith(quantity: _cap(quantity, state[index]));
    _persist();
  }

  void remove(String key) {
    state = state.where((line) => line.key != key).toList();
    _persist();
  }

  void clear() {
    state = const [];
    _prefs.remove(_key);
  }

  /// The server caps a line at 99 and refuses more than is on the shelf. Local
  /// stock genuinely runs out; an import is bought to order, so its on-hand
  /// figure is not a ceiling.
  static int _cap(int quantity, CartLine line) {
    final ceiling = line.sourcing.isImport
        ? 99
        : (line.option?.stock ?? line.product.stock).clamp(1, 99);
    return quantity.clamp(1, ceiling == 0 ? 1 : ceiling);
  }
}

final cartProvider = StateNotifierProvider<CartController, List<CartLine>>(
  (ref) => CartController(ref.watch(preferencesProvider)),
);

final cartCountProvider = Provider<int>(
  (ref) => ref.watch(cartProvider).fold(0, (sum, line) => sum + line.quantity),
);

/// Whether this basket must be prepaid. A hint for the interface only — the
/// server decides again against the real products.
final cartHasImportProvider = Provider<bool>(
  (ref) => ref.watch(cartProvider).any((line) => line.isImport),
);

/// The basket priced by the server. Re-runs whenever a line changes.
final cartQuoteProvider = FutureProvider.autoDispose((ref) async {
  final lines = ref.watch(cartProvider);
  if (lines.isEmpty) return CartQuote.empty;
  // Hold the answer briefly so bouncing between cart and checkout does not
  // re-price an unchanged basket.
  ref.keepAlive();
  return ref.watch(commerceServiceProvider).quote(lines);
});
