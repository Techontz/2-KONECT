import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../domain/models/product.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../widgets/async_state.dart';
import '../../widgets/product_card.dart';
import '../../widgets/search_bar.dart';
import '../../widgets/section_header.dart';
import '../../widgets/states.dart';
import '../../widgets/toast.dart';
import '../categories/category_products_screen.dart';
import '../home/home_screen.dart';
import '../home/home_sections.dart';
import '../search/filter_sheets.dart';
import '../search/search_screen.dart';

/// Deals tab — filter chips, today's-top-deals hero, tile grid, curated deal
/// shelves, mega deals, a live flash sale and the full "Shop All Deals" grid.
class DealsScreen extends StatefulWidget {
  const DealsScreen({super.key});

  @override
  State<DealsScreen> createState() => _DealsScreenState();
}

class _DealsScreenState extends State<DealsScreen> {
  final ScrollController _controller = ScrollController();
  ProductFilter _filter = const ProductFilter(dealsOnly: true);
  SortOption _sort = SortOption.biggestDiscount;
  bool _showBackToTop = false;
  int _visible = 12;

  @override
  void initState() {
    super.initState();
    _loadDeals();
    _controller.addListener(_onScroll);
  }

  void _onScroll() {
    final show = _controller.offset > 900;
    if (show != _showBackToTop) setState(() => _showBackToTop = show);
    if (_controller.position.pixels >
        _controller.position.maxScrollExtent - 700) {
      setState(() => _visible += 12);
    }
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  Loadable<List<Product>> _deals = const Loadable.loading();

  Future<void> _loadDeals() async {
    setState(() => _deals = const Loadable.loading());
    try {
      // The backend knows what is discounted; the app does not scan a local
      // catalogue to find out.
      final page = await context.read<CatalogRepository>().list(
            filter: const ProductFilter(dealsOnly: true),
            sort: SortOption.biggestDiscount,
            perPage: 60,
          );
      if (mounted) setState(() => _deals = Loadable.ready(page.products));
    } catch (error) {
      if (mounted) setState(() => _deals = Loadable.failed(error));
    }
  }

  void _openProducts(String title, List<Product> products) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CategoryProductsScreen.shelf(
          title: title,
          fixedProducts: products,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final repo = context.watch<CatalogRepository>();

    final allDeals = repo.applySort(_deals.value ?? const <Product>[], _sort);
    final shown = allDeals.take(_visible).toList();

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Stack(
        children: [
          CustomScrollView(
            controller: _controller,
            physics: const BouncingScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                        AppSpacing.gutter, 8, AppSpacing.gutter, 12),
                    child: D2KSearchField(
                      elevated: false,
                      hint: strings.searchPrefix,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SearchScreen()),
                      ),
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: _DealsFilterChips(
                  filter: _filter,
                  sort: _sort,
                  onFilterChanged: (value) => setState(() => _filter = value),
                  onSortChanged: (value) => setState(() => _sort = value),
                  products: allDeals,
                ),
              ),
              SliverToBoxAdapter(
                child: HomeProductShelf(
                  title: 'Less seen, more loved',
                  actionLabel: strings.viewAll,
                  products: allDeals.skip(12).take(12).toList(),
                  onAction: () => _openProducts('Less seen, more loved', allDeals),
                ),
              ),
              SliverToBoxAdapter(
                child: MegaDealsSection(
                  products: allDeals.take(6).toList(),
                  onAllDeals: () => _openProducts(strings.allDeals, allDeals),
                ),
              ),
              SliverToBoxAdapter(
                child: HomeProductShelf(
                  title: 'Bestselling deals',
                  actionLabel: strings.viewAll,
                  products: allDeals.where((p) => p.isBestSeller).take(12).toList(),
                  onAction: () => _openProducts('Bestselling deals', allDeals),
                ),
              ),
              SliverToBoxAdapter(
                child: FlashSaleSection(
                  products: allDeals.where((p) => p.discountPercent >= 40).take(8).toList(),
                  onViewAll: () => _openProducts('Flash sale', allDeals),
                ),
              ),
              SliverToBoxAdapter(
                child: HomeProductShelf(
                  title: 'Trending deals',
                  actionLabel: strings.viewAll,
                  products: allDeals.skip(24).take(12).toList(),
                  onAction: () => _openProducts('Trending deals', allDeals),
                ),
              ),
              SliverToBoxAdapter(
                child: HomeProductShelf(
                  title: 'Coupon savings',
                  actionLabel: strings.viewAll,
                  products: allDeals.skip(36).take(10).toList(),
                  onAction: () => _openProducts('Coupon savings', allDeals),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sectionGap),
                  child: SectionHeader(title: 'Shop All Deals'),
                ),
              ),
              if (shown.isEmpty)
                SliverToBoxAdapter(
                  child: StatusView(
                    icon: Icons.local_offer_outlined,
                    title: strings.nothingHere,
                    message: strings.noResultsBody,
                    compact: true,
                  ),
                )
              else
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
                          ProductCard.grid(product: shown[index]),
                      childCount: shown.length,
                    ),
                  ),
                ),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 70,
            child: BackToTopButton(
              visible: _showBackToTop,
              onTap: () => _controller.animateTo(
                0,
                duration: const Duration(milliseconds: 500),
                curve: Curves.easeOutCubic,
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 14,
            child: SortFilterPill(
              activeFilters: _filter.activeCount - 1 < 0
                  ? 0
                  : _filter.activeCount - 1,
              onSort: () async {
                final result = await showSortSheet(context, _sort);
                if (result != null) setState(() => _sort = result);
              },
              onFilter: () async {
                final result = await showFilterSheet(
                  context,
                  filter: _filter,
                  brands: repo.brandsFrom(allDeals),
                );
                if (result != null) {
                  setState(() {
                    _filter = result.copyWith(dealsOnly: true);
                    _visible = 12;
                  });
                }
              },
              onShare: () => D2KToast.show(
                context,
                'Deals link copied — share it with friends',
                icon: Icons.ios_share,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Horizontal dropdown-style chips ("Deals ⌄  Brand ⌄  Colour ⌄  More ⌄").
class _DealsFilterChips extends StatelessWidget {
  const _DealsFilterChips({
    required this.filter,
    required this.sort,
    required this.onFilterChanged,
    required this.onSortChanged,
    required this.products,
  });

  final ProductFilter filter;
  final SortOption sort;
  final ValueChanged<ProductFilter> onFilterChanged;
  final ValueChanged<SortOption> onSortChanged;

  /// The brand facet is derived from the products actually on screen.
  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    final repo = context.read<CatalogRepository>();
    final chips = <(String, IconData, VoidCallback)>[
      (
        'Deals',
        Icons.percent,
        () async {
          final result = await showSortSheet(context, sort);
          if (result != null) onSortChanged(result);
        }
      ),
      (
        'Brand',
        Icons.sell_outlined,
        () async {
          final result = await showFilterSheet(
            context,
            filter: filter,
            brands: repo.brandsFrom(products),
          );
          if (result != null) onFilterChanged(result.copyWith(dealsOnly: true));
        }
      ),
      (
        'Express',
        Icons.bolt,
        () => onFilterChanged(filter.copyWith(expressOnly: !filter.expressOnly))
      ),
      (
        'Top rated',
        Icons.star_outline,
        () => onFilterChanged(
              filter.minRating == null
                  ? filter.copyWith(minRating: 4.5)
                  : filter.copyWith(clearRating: true),
            )
      ),
    ];

    return SizedBox(
      height: 56,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final chip = chips[index];
          final active = switch (index) {
            2 => filter.expressOnly,
            3 => filter.minRating != null,
            _ => false,
          };
          return GestureDetector(
            onTap: chip.$3,
            child: Container(
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: active ? AppColors.primarySoft : AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(
                  color: active ? AppColors.primary : AppColors.divider,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(chip.$2, size: 16, color: AppColors.textPrimary),
                  const SizedBox(width: 7),
                  Text(chip.$1, style: AppTypography.buttonSmall),
                  const Icon(Icons.keyboard_arrow_down, size: 18),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
