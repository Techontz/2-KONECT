import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/catalog.dart';
import '../models/product.dart';
import '../services/catalog_service.dart';
import 'core.dart';

/// The home feed. Held for the session so returning to Home from a product is
/// instant rather than a fresh 6-second catalogue fetch.
final homeFeedProvider = FutureProvider<HomeFeed>((ref) async {
  return ref.watch(catalogServiceProvider).home();
});

/// The category tree. Moves only when an administrator edits it, so it is
/// fetched once and kept.
final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  return ref.watch(catalogServiceProvider).categories();
});

final categoryPageProvider =
    FutureProvider.family<CategoryPage, int>((ref, id) async {
  return ref.watch(catalogServiceProvider).category(id);
});

final vendorsProvider = FutureProvider<List<VendorSummary>>((ref) async {
  return ref.watch(catalogServiceProvider).vendors();
});

/// A product page, keyed by id.
///
/// `autoDispose` with a short retention: browsing back and forth between a
/// shelf and a product should not refetch, but holding fifty product payloads
/// for the life of the process would.
final productProvider = FutureProvider.autoDispose.family<ProductPage, int>((ref, id) async {
  final link = ref.keepAlive();
  final timer = Timer(const Duration(minutes: 5), link.close);
  ref.onDispose(timer.cancel);
  return ref.watch(catalogServiceProvider).product(id);
});

/// Cards the app already holds, seeded when one is tapped so the product
/// screen can paint the photo, name and price on the first frame instead of
/// after a round trip.
///
/// Bounded: a long browsing session would otherwise accumulate a card for
/// every product ever tapped, and only the last handful are ever read.
class ProductPreviews extends StateNotifier<Map<int, ProductCardModel>> {
  ProductPreviews() : super(const {});

  static const _limit = 24;

  void seed(ProductCardModel product) {
    final next = {...state, product.id: product};
    if (next.length > _limit) {
      // Drop the oldest insertions; Dart maps keep insertion order.
      final keys = next.keys.take(next.length - _limit).toList();
      for (final key in keys) {
        next.remove(key);
      }
    }
    state = next;
  }
}

final productPreviewProvider =
    StateNotifierProvider<ProductPreviews, Map<int, ProductCardModel>>(
  (ref) => ProductPreviews(),
);

/// A single page of a listing. Used by search, category and shop screens.
final listingProvider =
    FutureProvider.autoDispose.family<ProductListing, ProductQuery>((ref, query) async {
  final cancel = CancelToken();
  ref.onDispose(cancel.cancel);
  return ref.watch(catalogServiceProvider).products(query, cancelToken: cancel);
});

/// Type-ahead. Debounced here rather than in the widget, so every caller gets
/// the same behaviour and a fast typist issues one request instead of nine.
final suggestionsProvider =
    FutureProvider.autoDispose.family<Suggestions, String>((ref, term) async {
  final trimmed = term.trim();
  if (trimmed.length < 2) return Suggestions.empty;

  final cancel = CancelToken();
  ref.onDispose(cancel.cancel);

  await Future<void>.delayed(const Duration(milliseconds: 280));
  if (cancel.isCancelled) return Suggestions.empty;

  return ref.watch(catalogServiceProvider).suggest(trimmed, cancelToken: cancel);
});

/// Recent searches, so the search screen has something useful in it before a
/// single key is pressed.
class RecentSearches extends StateNotifier<List<String>> {
  RecentSearches(this._ref) : super(const []) {
    final stored = _ref.read(preferencesProvider).getStringList(_key);
    if (stored != null) state = stored;
  }

  final Ref _ref;
  static const _key = '2konect.recentSearches';
  static const _limit = 8;

  void record(String term) {
    final trimmed = term.trim();
    if (trimmed.isEmpty) return;
    final next = [trimmed, ...state.where((t) => t.toLowerCase() != trimmed.toLowerCase())]
        .take(_limit)
        .toList();
    state = next;
    _ref.read(preferencesProvider).setStringList(_key, next);
  }

  void clear() {
    state = const [];
    _ref.read(preferencesProvider).remove(_key);
  }
}

final recentSearchesProvider =
    StateNotifierProvider<RecentSearches, List<String>>((ref) => RecentSearches(ref));
