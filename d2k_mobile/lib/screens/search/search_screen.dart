import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../data/promo_data.dart';
import '../../domain/models/product.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../state/app_controllers.dart';
import '../../widgets/product_card.dart';
import '../../widgets/search_bar.dart';
import '../../widgets/states.dart';
import 'filter_sheets.dart';

enum _SearchStage { idle, suggesting, loading, results, empty }

/// Full search experience: recents + trending when idle, live suggestions
/// while typing, a chip rail with the reference's quick collections, and a
/// two-column result grid with sort/filter.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  final ScrollController _scrollController = ScrollController();

  Timer? _debounce;
  _SearchStage _stage = _SearchStage.idle;
  List<Product> _results = const [];
  List<String> _suggestions = const [];
  String _activeQuery = '';
  int _collection = -1;

  ProductFilter _filter = const ProductFilter();
  SortOption _sort = SortOption.recommended;

  static const _collections = ['newArrivals', 'topRated', 'bestsellers'];

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery != null && widget.initialQuery!.isNotEmpty) {
      _controller.text = widget.initialQuery!;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _submit(widget.initialQuery!);
      });
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    if (value.trim().isEmpty) {
      setState(() {
        _stage = _SearchStage.idle;
        _suggestions = const [];
        _results = const [];
        _activeQuery = '';
      });
      return;
    }
    // Suggestions come from the backend, so the request is debounced and its
    // result discarded if the query moved on while it was in flight.
    _debounce = Timer(const Duration(milliseconds: 220), () async {
      if (!mounted) return;
      setState(() => _stage = _SearchStage.suggesting);
      try {
        final suggestions =
            await context.read<CatalogRepository>().suggestions(value);
        if (!mounted || _controller.text.trim() != value.trim()) return;
        setState(() => _suggestions = suggestions);
      } catch (_) {
        if (mounted) setState(() => _suggestions = const []);
      }
    });
  }

  Future<void> _submit(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;
    _focusNode.unfocus();
    _controller.text = trimmed;
    context.read<BrowsingHistoryController>().recordSearch(trimmed);

    setState(() {
      _stage = _SearchStage.loading;
      _activeQuery = trimmed;
      _collection = -1;
    });

    final results = await context.read<CatalogRepository>().search(trimmed);
    if (!mounted) return;
    setState(() {
      _results = results;
      _stage = results.isEmpty ? _SearchStage.empty : _SearchStage.results;
    });
  }

  /// A curated collection is just a search the backend answers.
  Future<void> _selectCollection(int index) async {
    setState(() {
      _collection = index;
      _activeQuery = '';
      _controller.clear();
      _stage = _SearchStage.results;
      _results = const [];
    });
    _focusNode.unfocus();

    try {
      final products =
          await context.read<CatalogRepository>().search(_collections[index]);
      if (mounted) setState(() => _results = products);
    } catch (_) {
      if (mounted) setState(() => _results = const []);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter, 8, AppSpacing.gutter, 10),
              child: D2KSearchInput(
                controller: _controller,
                focusNode: _focusNode,
                onChanged: _onChanged,
                onSubmitted: _submit,
              ),
            ),
            _CollectionChips(
              labels: [
                strings.newArrivals,
                strings.highlyRated,
                strings.bestsellers.toUpperCase(),
              ],
              selected: _collection,
              onSelect: _selectCollection,
            ),
            Expanded(child: _body(strings)),
          ],
        ),
      ),
    );
  }

  Widget _body(AppStrings strings) {
    switch (_stage) {
      case _SearchStage.idle:
        return _IdleView(
          onQuery: _submit,
        );
      case _SearchStage.suggesting:
        return _SuggestionList(
          suggestions: _suggestions,
          query: _controller.text,
          onTap: _submit,
        );
      case _SearchStage.loading:
        return const _ResultsSkeleton();
      case _SearchStage.empty:
        return StatusView(
          icon: Icons.search_off,
          title: strings.noResultsTitle,
          message: strings.noResultsBody,
          actionLabel: strings.clearAll,
          onAction: () {
            _controller.clear();
            setState(() => _stage = _SearchStage.idle);
          },
        );
      case _SearchStage.results:
        return _ResultsView(
          scrollController: _scrollController,
          products: context
              .read<CatalogRepository>()
              .applySort(_results, _sort),
          headerBanner: _collection >= 0,
          title: _activeQuery.isEmpty
              ? strings.exploreMore
              : '$_activeQuery — ${_results.length} ${strings.results}',
          activeFilters: _filter.activeCount,
          onSort: () async {
            final result = await showSortSheet(context, _sort);
            if (result != null) setState(() => _sort = result);
          },
          onFilter: () async {
            final repo = context.read<CatalogRepository>();
            final result = await showFilterSheet(
              context,
              filter: _filter,
              brands: repo.brandsFrom(_results),
            );
            if (result != null) setState(() => _filter = result);
          },
        );
    }
  }
}

class _CollectionChips extends StatelessWidget {
  const _CollectionChips({
    required this.labels,
    required this.selected,
    required this.onSelect,
  });

  final List<String> labels;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 60,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
        itemCount: labels.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final active = index == selected;
          return GestureDetector(
            onTap: () => onSelect(index),
            child: Container(
              constraints: const BoxConstraints(minWidth: 120, maxWidth: 190),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              decoration: BoxDecoration(
                color: active ? AppColors.chipSelected : AppColors.chipSurface,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Text(
                labels[index],
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.badge.copyWith(
                  fontSize: 12.5,
                  height: 1.15,
                  color: active ? Colors.white : AppColors.textPrimary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _IdleView extends StatelessWidget {
  const _IdleView({required this.onQuery});

  final ValueChanged<String> onQuery;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final history = context.watch<BrowsingHistoryController>();

    return ListView(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter, 8, AppSpacing.gutter, 32),
      children: [
        if (history.recentSearches.isNotEmpty) ...[
          Row(
            children: [
              Expanded(
                child: Text(strings.recentSearches,
                    style: AppTypography.sectionTitle),
              ),
              TextButton(
                onPressed: () =>
                    context.read<BrowsingHistoryController>().clearSearches(),
                child:
                    Text(strings.clearAll, style: AppTypography.sectionAction),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final term in history.recentSearches)
                _TermChip(
                  label: term,
                  icon: Icons.history,
                  onTap: () => onQuery(term),
                ),
            ],
          ),
          const SizedBox(height: 26),
        ],
        Text(strings.trendingSearches, style: AppTypography.sectionTitle),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final term in PromoData.trendingSearches)
              _TermChip(
                label: term,
                icon: Icons.trending_up,
                onTap: () => onQuery(term),
              ),
          ],
        ),
        const SizedBox(height: 26),
        if (history.recentlyViewed.isNotEmpty) ...[
          Text(strings.recentlyViewed, style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          SizedBox(
            height: AppSizes.productShelfHeight,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: history.recentlyViewed.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) =>
                  ProductCard(product: history.recentlyViewed[index]),
            ),
          ),
        ],
      ],
    );
  }
}

class _TermChip extends StatelessWidget {
  const _TermChip({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.chipSurface,
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: AppColors.textSecondary),
            const SizedBox(width: 7),
            Text(label, style: AppTypography.buttonSmall),
          ],
        ),
      ),
    );
  }
}

class _SuggestionList extends StatelessWidget {
  const _SuggestionList({
    required this.suggestions,
    required this.query,
    required this.onTap,
  });

  final List<String> suggestions;
  final String query;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    if (suggestions.isEmpty) {
      return StatusView(
        icon: Icons.search,
        title: context.strings.suggestions,
        message: context.strings.noResultsBody,
        compact: true,
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 4),
      itemCount: suggestions.length,
      separatorBuilder: (_, __) => const Divider(height: 1, indent: 56),
      itemBuilder: (context, index) {
        final suggestion = suggestions[index];
        return ListTile(
          leading: const Icon(Icons.search, color: AppColors.textSecondary),
          title: Text(
            suggestion,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.body,
          ),
          trailing: const Icon(Icons.north_west,
              size: 18, color: AppColors.textTertiary),
          onTap: () => onTap(suggestion),
        );
      },
    );
  }
}

class _ResultsView extends StatelessWidget {
  const _ResultsView({
    required this.scrollController,
    required this.products,
    required this.title,
    required this.onSort,
    required this.onFilter,
    required this.activeFilters,
    this.headerBanner = false,
  });

  final ScrollController scrollController;
  final List<Product> products;
  final String title;
  final VoidCallback onSort;
  final VoidCallback onFilter;
  final int activeFilters;
  final bool headerBanner;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) {
      return StatusView(
        icon: Icons.filter_alt_off_outlined,
        title: context.strings.noResultsTitle,
        message: context.strings.noResultsBody,
      );
    }
    return Stack(
      children: [
        CustomScrollView(
          controller: scrollController,
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.gutter, 16, AppSpacing.gutter, 8),
                child: Text(title, style: AppTypography.sectionTitle),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter, 4, AppSpacing.gutter, 96),
              sliver: SliverGrid(
                gridDelegate:
                    SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  mainAxisExtent: AppSizes.productGridExtentFor(context),
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) =>
                      ProductCard.grid(product: products[index]),
                  childCount: products.length,
                ),
              ),
            ),
          ],
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 16,
          child: SortFilterPill(
            onSort: onSort,
            onFilter: onFilter,
            activeFilters: activeFilters,
          ),
        ),
      ],
    );
  }
}

class _ResultsSkeleton extends StatelessWidget {
  const _ResultsSkeleton();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(AppSpacing.gutter),
      itemCount: 6,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        mainAxisExtent: AppSizes.productGridExtentFor(context),
      ),
      itemBuilder: (_, __) => const ProductCardSkeleton(width: double.infinity),
    );
  }
}
