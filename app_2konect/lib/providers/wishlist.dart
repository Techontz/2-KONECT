import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/network/api_exception.dart';
import '../models/product.dart';
import '../services/account_service.dart';
import 'core.dart';
import 'session.dart';

/// Saved items.
///
/// The backend owns the list for a signed-in shopper — that is what makes a
/// wishlist follow somebody from the website to the phone. A guest's saves are
/// kept locally and handed to the server on sign-in, so nothing is lost by
/// browsing first and registering later.
class WishlistState {
  const WishlistState({
    this.ids = const {},
    this.products = const [],
    this.loading = false,
  });

  final Set<int> ids;
  final List<ProductCardModel> products;
  final bool loading;

  bool has(int productId) => ids.contains(productId);

  WishlistState copyWith({
    Set<int>? ids,
    List<ProductCardModel>? products,
    bool? loading,
  }) =>
      WishlistState(
        ids: ids ?? this.ids,
        products: products ?? this.products,
        loading: loading ?? this.loading,
      );
}

class WishlistController extends StateNotifier<WishlistState> {
  WishlistController(this._service, this._prefs, this._signedIn)
      : super(const WishlistState()) {
    _loadLocal();
    if (_signedIn) unawaitedSync();
  }

  final AccountService _service;
  final SharedPreferences _prefs;
  final bool _signedIn;

  static const _key = '2konect.wishlist.v1';

  void _loadLocal() {
    final raw = _prefs.getStringList(_key);
    if (raw == null) return;
    state = state.copyWith(ids: raw.map(int.tryParse).whereType<int>().toSet());
  }

  void _persistLocal() {
    _prefs.setStringList(_key, state.ids.map((id) => '$id').toList());
  }

  void unawaitedSync() {
    // ignore: discarded_futures
    sync();
  }

  /// Merges whatever was saved as a guest into the account's list.
  Future<void> sync() async {
    if (!_signedIn) return;
    state = state.copyWith(loading: true);
    try {
      final result = state.ids.isEmpty
          ? await _service.wishlist()
          : await _service.syncWishlist(state.ids.toList());
      state = WishlistState(ids: result.ids.toSet(), products: result.products);
      _persistLocal();
    } on ApiException {
      state = state.copyWith(loading: false);
    }
  }

  Future<void> refresh() async {
    if (!_signedIn) return;
    state = state.copyWith(loading: true);
    try {
      final result = await _service.wishlist();
      state = WishlistState(ids: result.ids.toSet(), products: result.products);
      _persistLocal();
    } on ApiException {
      state = state.copyWith(loading: false);
    }
  }

  /// Optimistic: the heart fills immediately and rolls back only if the server
  /// refuses, because a save that waits for a round trip feels broken.
  Future<void> toggle(int productId) async {
    final wasSaved = state.has(productId);
    final ids = {...state.ids};
    wasSaved ? ids.remove(productId) : ids.add(productId);

    state = state.copyWith(
      ids: ids,
      products: wasSaved
          ? state.products.where((p) => p.id != productId).toList()
          : state.products,
    );
    _persistLocal();

    if (!_signedIn) return;

    try {
      if (wasSaved) {
        await _service.removeFromWishlist(productId);
      } else {
        await _service.addToWishlist(productId);
        await refresh();
      }
    } on ApiException {
      // Put it back the way it was.
      final restored = {...state.ids};
      wasSaved ? restored.add(productId) : restored.remove(productId);
      state = state.copyWith(ids: restored);
      _persistLocal();
      rethrow;
    }
  }
}

final wishlistProvider = StateNotifierProvider<WishlistController, WishlistState>((ref) {
  return WishlistController(
    ref.watch(accountServiceProvider),
    ref.watch(preferencesProvider),
    ref.watch(isSignedInProvider),
  );
});
