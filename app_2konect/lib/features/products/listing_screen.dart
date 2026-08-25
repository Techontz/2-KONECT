import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/tokens.dart';
import '../../models/catalog.dart';
import '../../models/common.dart';
import '../../models/product.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../services/catalog_service.dart';
import '../../widgets/product_grid.dart';
import '../../widgets/states.dart';
import 'widgets/filter_sheet.dart';

/// The product grid: shop, category, search results and every filtered view.
///
/// One implementation, parameterised — the website has exactly one
/// `ListingView` for the same reason. Paging appends rather than replaces, so
/// scrolling never loses the shopper's place, and the facets are re-read from
/// each response so the filter sheet always describes *this* result set.
class ListingScreen extends ConsumerStatefulWidget {
  const ListingScreen({
    super.key,
    this.title,
    this.availability,
    this.categoryId,
    this.subcategoryId,
    this.vendorId,
    this.term,
    this.onSale = false,
    this.verified = false,
    this.showAppBar = true,
  });

  final String? title;

  /// When set, the screen *is* this scope — the filter sheet does not offer to
  /// change it, and it is not counted as an applied filter.
  final Availability? availability;
  final int? categoryId;
  final int? subcategoryId;
  final int? vendorId;
  final String? term;
  final bool onSale;
  final bool verified;
  final bool showAppBar;

  @override
  ConsumerState<ListingScreen> createState() => _ListingScreenState();
}

class _ListingScreenState extends ConsumerState<ListingScreen> {
  final _scroll = ScrollController();

  late ProductQuery _query;

  /// Everything fetched so far, across pages. The screen owns its own paging
  /// rather than reading a per-page provider, because "page 3 appended to
  /// pages 1 and 2" is state, not a derivable value.
  final List<ProductCardModel> _products = [];
  ListingMeta _meta = ListingMeta.empty;
  ListingFilters _filters = ListingFilters.empty;

  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;

  /// Guards against a slow page-one response landing after the shopper has
  /// already changed the filters.
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _query = ProductQuery(
      availability: widget.availability,
      categoryId: widget.categoryId,
      subcategoryId: widget.subcategoryId,
      vendorId: widget.vendorId,
      q: widget.term,
      onSale: widget.onSale ? true : null,
      verified: widget.verified ? true : null,
      sort: widget.term != null ? ProductSort.relevance : ProductSort.newest,
    );
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void didUpdateWidget(ListingScreen old) {
    super.didUpdateWidget(old);
    if (old.term != widget.term) {
      _applyQuery(_query.copyWith(q: widget.term));
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final listing =
          await ref.read(catalogServiceProvider).products(_query.copyWith(page: 1));
      if (!mounted || generation != _generation) return;
      setState(() {
        _products
          ..clear()
          ..addAll(listing.products);
        _meta = listing.meta;
        _filters = listing.filters;
        _loading = false;
      });
    } on Object catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _loading = false;
        _error = error;
      });
    }
  }

  void _onScroll() {
    if (!_scroll.hasClients || _loading || _loadingMore || !_meta.hasMore) return;
    // Fetch a screen early, so the grid keeps flowing rather than stopping at
    // a spinner the shopper has to wait behind.
    if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 900) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_meta.hasMore) return;
    final generation = _generation;
    setState(() => _loadingMore = true);

    try {
      final listing = await ref
          .read(catalogServiceProvider)
          .products(_query.copyWith(page: _meta.currentPage + 1));
      if (!mounted || generation != _generation) return;
      setState(() {
        _products.addAll(listing.products);
        _meta = listing.meta;
        _loadingMore = false;
      });
    } on Object {
      // A failed page is not a failed screen: what has already loaded stays,
      // and scrolling further tries again.
      if (mounted && generation == _generation) setState(() => _loadingMore = false);
    }
  }

  /// A changed filter starts the list again from page one.
  void _applyQuery(ProductQuery next) {
    setState(() => _query = next.copyWith(page: 1));
    if (_scroll.hasClients) _scroll.jumpTo(0);
    _load();
  }

  Future<void> _openFilters() async {
    final result = await showModalBottomSheet<ProductQuery>(
      context: context,
      isScrollControlled: true,
      builder: (_) => FilterSheet(
        query: _query,
        filters: _filters,
        resultCount: _meta.total,
        lockedAvailability: widget.availability,
      ),
    );
    if (result != null) _applyQuery(result);
  }

  Future<void> _openSort() async {
    final result = await showModalBottomSheet<ProductSort>(
      context: context,
      builder: (_) => _SortSheet(current: _query.sort),
    );
    if (result != null && result != _query.sort) {
      _applyQuery(_query.copyWith(sort: result));
    }
  }

  @override
  Widget build(BuildContext context) {
    final Widget body;
    if (_loading && _products.isEmpty) {
      body = const ProductGridSkeleton();
    } else if (_error != null && _products.isEmpty) {
      body = ErrorState(error: _error!, onRetry: _load);
    } else if (_products.isEmpty) {
      body = _empty();
    } else {
      body = _grid();
    }

    return Scaffold(
      appBar: widget.showAppBar
          ? AppBar(
              title: Text(widget.title ?? ref.t('listing.productsFallback')),
              actions: [
                IconButton(
                  tooltip: ref.t('header.searchAria'),
                  onPressed: () => context.push('/search'),
                  icon: const Icon(Icons.search_rounded),
                ),
              ],
            )
          : null,
      body: Column(
        children: [
          _Toolbar(
            total: _meta.total,
            sort: _query.sort,
            applied: _query.appliedCount(scopedAvailability: widget.availability),
            onFilters: _openFilters,
            onSort: _openSort,
          ),
          const Divider(height: 1),
          Expanded(child: body),
        ],
      ),
    );
  }

  Widget _empty() => EmptyState(
        icon: Icons.search_off_rounded,
        title: _query.appliedCount(scopedAvailability: widget.availability) > 0
            ? ref.t('listing.nothingMatched')
            : ref.t('listing.noResults'),
        message: ref.t('listing.nothingMatchedHint'),
        actionLabel: ref.t('nav.requestProduct'),
        onAction: () => context.push(
          _query.q == null ? '/request' : '/request?q=${Uri.encodeComponent(_query.q!)}',
        ),
      );

  Widget _grid() {
    return RefreshIndicator(
      color: K.brand,
      onRefresh: _load,
      child: ProductGridView(
        products: _products,
        controller: _scroll,
        loadingMore: _loadingMore,
      ),
    );
  }
}

class _Toolbar extends ConsumerWidget {
  const _Toolbar({
    required this.total,
    required this.sort,
    required this.applied,
    required this.onFilters,
    required this.onSort,
  });

  final int total;
  final ProductSort sort;
  final int applied;
  final VoidCallback onFilters;
  final VoidCallback onSort;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      color: K.surface,
      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              total == 1
                  ? ref.t('listing.productCountOne')
                  : ref.t('listing.productCount', {'count': total}),
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: K.inkMuted),
            ),
          ),
          TextButton.icon(
            onPressed: onSort,
            icon: const Icon(Icons.swap_vert_rounded, size: 17),
            label: Text(ref.t(sort.labelKey), overflow: TextOverflow.ellipsis),
            style: TextButton.styleFrom(
              foregroundColor: K.inkSoft,
              textStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: K.s2),
          Badge(
            isLabelVisible: applied > 0,
            label: Text('$applied'),
            backgroundColor: K.brand,
            child: OutlinedButton.icon(
              onPressed: onFilters,
              icon: const Icon(Icons.tune_rounded, size: 16),
              label: Text(ref.t('filters.open')),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 36),
                padding: const EdgeInsets.symmetric(horizontal: 11),
                textStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SortSheet extends ConsumerWidget {
  const _SortSheet({required this.current});

  final ProductSort current;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
            child: Text(ref.t('listing.sortBy'), style: Theme.of(context).textTheme.titleLarge),
          ),
          for (final sort in ProductSort.values)
            ListTile(
              onTap: () => Navigator.pop(context, sort),
              title: Text(
                ref.t(sort.labelKey),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: sort == current ? FontWeight.w700 : FontWeight.w500,
                  color: sort == current ? K.brand : K.ink,
                ),
              ),
              trailing: sort == current
                  ? const Icon(Icons.check_rounded, size: 19, color: K.brand)
                  : null,
            ),
          const SizedBox(height: K.s8),
        ],
      ),
    );
  }
}

