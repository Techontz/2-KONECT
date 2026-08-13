import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../domain/models/catalog.dart';
import '../../domain/models/product.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../widgets/product_card.dart';
import '../../widgets/search_bar.dart';
import '../../widgets/states.dart';
import '../search/filter_sheets.dart';
import '../search/search_screen.dart';

/// Category listing: title, search, subcategory chips, a two-column product
/// grid, and the floating Sort/Filter pill from the reference.
class CategoryProductsScreen extends StatefulWidget {
  const CategoryProductsScreen({
    super.key,
    required this.category,
    this.subcategory,
  })  : title = null,
        fixedProducts = null;

  /// Variant used for curated shelves ("Trending deals", "Top rated").
  const CategoryProductsScreen.shelf({
    super.key,
    required String this.title,
    required List<Product> this.fixedProducts,
  })  : category = null,
        subcategory = null;

  final Category? category;
  final String? subcategory;
  final String? title;
  final List<Product>? fixedProducts;

  @override
  State<CategoryProductsScreen> createState() => _CategoryProductsScreenState();
}

class _CategoryProductsScreenState extends State<CategoryProductsScreen> {
  final ScrollController _controller = ScrollController();

  late ProductFilter _filter;
  SortOption _sort = SortOption.recommended;
  late Future<List<Product>> _future;

  /// Page size for the incremental "infinite" listing.
  static const int _pageSize = 20;
  int _visible = _pageSize;

  @override
  void initState() {
    super.initState();
    _filter = ProductFilter(
      categoryId: widget.category?.id,
      subcategory: widget.subcategory,
    );
    _future = _load();
    _controller.addListener(_onScroll);
  }

  Future<List<Product>> _load() {
    final repo = context.read<CatalogRepository>();
    if (widget.fixedProducts != null) {
      return Future.value(widget.fixedProducts);
    }
    return repo.byCategory(widget.category!.id);
  }

  void _onScroll() {
    if (_controller.position.pixels >
        _controller.position.maxScrollExtent - 600) {
      setState(() => _visible += _pageSize);
    }
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() {
      _visible = _pageSize;
      _future = _load();
    });
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final repo = context.read<CatalogRepository>();
    final title = widget.title ?? widget.subcategory ?? widget.category!.name;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(title, style: AppTypography.sectionTitle.copyWith(fontSize: 17)),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, size: 24),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => SearchScreen(initialQuery: title),
              ),
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: FutureBuilder<List<Product>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const _GridSkeleton();
          }
          if (snapshot.hasError) {
            return StatusView.error(context, onRetry: _reload);
          }

          final source = snapshot.data ?? const <Product>[];
          // The page arrived filtered and sorted by the backend; this only
          // applies the facets the API does not express (brand, rating).
          final products = repo.applySort(_refine(source), _sort);
          final shown = products.take(_visible).toList();

          return Stack(
            children: [
              RefreshIndicator(
                onRefresh: _reload,
                color: AppColors.primary,
                child: CustomScrollView(
                  controller: _controller,
                  physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics()),
                  slivers: [
                    SliverToBoxAdapter(
                      child: Container(
                        color: AppColors.surface,
                        padding: const EdgeInsets.fromLTRB(
                            AppSpacing.gutter, 4, AppSpacing.gutter, 12),
                        child: D2KSearchField(
                          elevated: false,
                          hint: '${strings.searchPrefix} $title',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => SearchScreen(initialQuery: title),
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (widget.category != null &&
                        widget.category!.subcategories.isNotEmpty)
                      SliverToBoxAdapter(
                        child: Container(
                          color: AppColors.surface,
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _SubcategoryChips(
                            subcategories: widget.category!.subcategories,
                            selected: _filter.subcategory,
                            onSelect: (name) => setState(() {
                              _filter = name == null
                                  ? _filter.copyWith(clearSubcategory: true)
                                  : _filter.copyWith(subcategory: name);
                              _visible = _pageSize;
                            }),
                          ),
                        ),
                      ),
                    SliverToBoxAdapter(
                      child: Container(
                        color: AppColors.surface,
                        padding: const EdgeInsets.fromLTRB(
                            AppSpacing.gutter, 0, AppSpacing.gutter, 12),
                        child: Row(
                          children: [
                            Text(
                              '${products.length} ${strings.results}',
                              style: AppTypography.metaMuted,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (shown.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: StatusView(
                          icon: Icons.search_off,
                          title: strings.noResultsTitle,
                          message: strings.noResultsBody,
                          actionLabel: strings.clearAll,
                          onAction: () => setState(() {
                            _filter = ProductFilter(
                              categoryId: widget.category?.id,
                            );
                            _visible = _pageSize;
                          }),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(
                            AppSpacing.gutter, 12, AppSpacing.gutter, 96),
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
                                ProductCard.grid(product: shown[index]),
                            childCount: shown.length,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 16,
                child: SortFilterPill(
                  activeFilters: _filter.activeCount,
                  onSort: _openSort,
                  onFilter: _openFilter,
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _openSort() async {
    final result = await showSortSheet(context, _sort);
    if (result != null) setState(() => _sort = result);
  }

  /// Facets the products endpoint has no parameter for.
  List<Product> _refine(List<Product> source) {
    _lastLoaded = source;
    return source.where((p) {
      if (_filter.subcategory != null && p.subcategory != _filter.subcategory) {
        return false;
      }
      if (_filter.brands.isNotEmpty && !_filter.brands.contains(p.brand)) {
        return false;
      }
      if (_filter.minRating != null && p.rating < _filter.minRating!) return false;
      if (_filter.dealsOnly && !p.hasDiscount) return false;
      if (_filter.expressOnly && !p.inStock) return false;
      if (_filter.minPriceBase != null && p.priceBase < _filter.minPriceBase!) {
        return false;
      }
      if (_filter.maxPriceBase != null && p.priceBase > _filter.maxPriceBase!) {
        return false;
      }
      return true;
    }).toList();
  }

  List<Product> _lastLoaded = const [];

  Future<void> _openFilter() async {
    final repo = context.read<CatalogRepository>();
    final result = await showFilterSheet(
      context,
      filter: _filter,
      brands: repo.brandsFrom(_lastLoaded),
    );
    if (result != null) {
      setState(() {
        _filter = result;
        _visible = _pageSize;
      });
    }
  }
}

class _SubcategoryChips extends StatelessWidget {
  const _SubcategoryChips({
    required this.subcategories,
    required this.selected,
    required this.onSelect,
  });

  final List<Subcategory> subcategories;
  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
        itemCount: subcategories.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final isAll = index == 0;
          final name = isAll ? null : subcategories[index - 1].name;
          final active = selected == name;
          return GestureDetector(
            onTap: () => onSelect(name),
            child: Container(
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: active ? AppColors.chipSelected : AppColors.chipSurface,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Text(
                isAll ? 'All' : name!,
                style: AppTypography.buttonSmall.copyWith(
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

class _GridSkeleton extends StatelessWidget {
  const _GridSkeleton();

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
