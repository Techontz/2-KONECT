import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../domain/models/catalog.dart';
import '../../domain/models/product.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../state/app_controllers.dart';
import '../../data/remote_catalog_source.dart';
import '../../widgets/async_state.dart';
import '../../widgets/banners.dart';
import '../../widgets/home_widgets.dart';
import '../../widgets/product_card.dart';
import '../../widgets/search_bar.dart';
import '../../widgets/section_header.dart';
import '../../widgets/states.dart';
import '../../widgets/tile_shelves.dart';
import '../../widgets/location_header.dart';
import '../categories/category_products_screen.dart';
import '../search/search_screen.dart';

/// The D2K home feed — a faithful rebuild of the reference composition:
/// location header → pinned search → promo strip → hero carousel → tile grid →
/// offers → product shelves → editorial sections → category shelves.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScrollController _scrollController = ScrollController();

  /// The whole home screen is one backend payload — banners, categories,
  /// shelves and collections are all admin-controlled.
  Loadable<HomeFeed> _feed = const Loadable.loading();
  bool _showBackToTop = false;

  @override
  void initState() {
    super.initState();
    _load();
    _scrollController.addListener(_onScroll);
  }

  Future<void> _load() async {
    if (mounted) setState(() => _feed = const Loadable.loading());
    try {
      final feed = await context.read<CatalogRepository>().home();
      if (mounted) setState(() => _feed = Loadable.ready(feed));
    } catch (error) {
      // No demo fallback: a failed request shows an error, never a catalogue
      // that looks real but is not.
      if (mounted) setState(() => _feed = Loadable.failed(error));
    }
  }

  void _onScroll() {
    final show = _scrollController.offset > 1200;
    if (show != _showBackToTop) setState(() => _showBackToTop = show);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  Future<void> _refresh() => _load();

  void _openSearch({String? query}) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => SearchScreen(initialQuery: query)),
    );
  }

  void _openCategory(String categoryId, {String? subcategory}) {
    final category = context.read<CatalogRepository>().categoryById(categoryId);
    if (category == null) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CategoryProductsScreen(
          category: category,
          subcategory: subcategory,
        ),
      ),
    );
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
    final history = context.watch<BrowsingHistoryController>();

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _refresh,
            color: AppColors.primary,
            child: CustomScrollView(
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics()),
              slivers: [
                SliverPersistentHeader(
                  pinned: true,
                  delegate: _HomeHeaderDelegate(
                    topInset: MediaQuery.paddingOf(context).top,
                    onSearchTap: _openSearch,
                  ),
                ),
                ..._feedSlivers(strings, history),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 16,
            child: BackToTopButton(
              visible: _showBackToTop,
              onTap: () => _scrollController.animateTo(
                0,
                duration: const Duration(milliseconds: 480),
                curve: Curves.easeOutCubic,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// The feed itself. While it loads the header stays put and the body shows
  /// skeletons; a failure replaces the body with an error and a retry, never
  /// with stand-in content.
  List<Widget> _feedSlivers(AppStrings strings, BrowsingHistoryController history) {
    if (_feed.isLoading) {
      return const [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.only(top: 24),
            child: Column(
              children: [ShelfSkeleton(), SizedBox(height: 24), ShelfSkeleton()],
            ),
          ),
        ),
      ];
    }

    if (_feed.hasFailed) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: ErrorState(
            message: _feed.message,
            onRetry: _load,
            canRetry: _feed.isRetryable,
          ),
        ),
      ];
    }

    final feed = _feed.value ?? HomeFeed.empty;

    if (feed.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: EmptyState(
            title: strings.nothingHereYet,
            message: strings.storefrontEmptyHint,
            icon: Icons.storefront_outlined,
            action: FilledButton(
              onPressed: _load,
              child: Text(strings.refresh),
            ),
          ),
        ),
      ];
    }

    final hero = [for (final b in feed.hero) b.toPromo()];
    // The side card is a second hero on a phone rather than a column beside it.
    if (feed.heroSide != null) hero.add(feed.heroSide!.toPromo());

    return [
      SliverToBoxAdapter(
        child: Container(
          color: AppColors.homeSkin,
          padding: const EdgeInsets.only(bottom: 18),
          child: Column(
            children: [
              if (hero.isNotEmpty) ...[
                const SizedBox(height: 6),
                HeroBannerCarousel(
                  banners: hero,
                  showIndicator: hero.length > 1,
                  onTap: _openBanner,
                ),
              ],
              if (feed.categories.isNotEmpty) ...[
                const SizedBox(height: 16),
                HomeCategoryRail(
                  categories: feed.categories,
                  onTap: (category) => _openCategory(category.id),
                ),
              ],
              if (feed.promos.isNotEmpty) ...[
                const SizedBox(height: 18),
                SectionHeader(
                  title: strings.offersForYou,
                  padding: const EdgeInsets.fromLTRB(
                      AppSpacing.gutter, 0, AppSpacing.gutter, 10),
                ),
                SizedBox(
                  height: 150,
                  child: HorizontalShelf(
                    itemCount: feed.promos.length,
                    spacing: 12,
                    itemBuilder: (context, index) => PromoCardView(
                      banner: feed.promos[index],
                      onTap: () => _openBanner(feed.promos[index].toPromo()),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),

      if (feed.deals.isNotEmpty)
        SliverToBoxAdapter(
          child: HomeProductShelf(
            title: strings.deals,
            actionLabel: strings.viewAllCaps,
            products: feed.deals,
            onAction: () => _openProducts(strings.deals, feed.deals),
            topPadding: 20,
          ),
        ),

      // Shelves and collections are configured in the admin, so their titles
      // and contents change without shipping a new build.
      for (final shelf in feed.shelves)
        if (shelf.products.isNotEmpty)
          SliverToBoxAdapter(
            child: HomeProductShelf(
              title: shelf.title,
              actionLabel: strings.viewAll,
              products: shelf.products,
              onAction: () => _openProducts(shelf.title, shelf.products),
            ),
          ),

      for (final collection in feed.collections)
        if (collection.products.isNotEmpty)
          SliverToBoxAdapter(
            child: HomeProductShelf(
              title: collection.title,
              actionLabel: strings.viewAll,
              products: collection.products,
              onAction: () => collection.categoryId != null
                  ? _openCategory(collection.categoryId!)
                  : _openProducts(collection.title, collection.products),
            ),
          ),

      // Subcategory tiles, straight from the catalogue tree.
      SliverToBoxAdapter(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final category in feed.categories)
              if (category.subcategories.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sectionGap),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionHeader(
                        title: category.name,
                        actionLabel: strings.viewAll,
                        onAction: () => _openCategory(category.id),
                      ),
                      ImageTileShelf(
                        items: category.subcategories,
                        onTap: (sub) => _openCategory(
                          category.id,
                          subcategory: sub.name,
                        ),
                      ),
                    ],
                  ),
                ),
          ],
        ),
      ),

      if (history.recentlyViewed.isNotEmpty)
        SliverToBoxAdapter(
          child: HomeProductShelf(
            title: strings.recentlyViewed,
            products: history.recentlyViewed,
          ),
        ),

      const SliverToBoxAdapter(child: SizedBox(height: 28)),
    ];
  }

  void _openBanner(PromoBanner banner) {
    if (banner.targetCategoryId != null) {
      _openCategory(banner.targetCategoryId!);
    } else if (banner.targetQuery != null) {
      _openSearch(query: banner.targetQuery);
    }
  }
}

/// Pinned home header: the delivery-location row scrolls away while the search
/// field stays docked below the status bar, exactly as in the reference.
class _HomeHeaderDelegate extends SliverPersistentHeaderDelegate {
  const _HomeHeaderDelegate({
    required this.topInset,
    required this.onSearchTap,
  });

  final double topInset;
  final VoidCallback onSearchTap;

  static const double _locationHeight = 56;
  static const double _searchBlock = AppSizes.searchBarHeight + 14;

  @override
  double get minExtent => topInset + _searchBlock;

  @override
  double get maxExtent => topInset + _locationHeight + _searchBlock;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final collapse = (shrinkOffset / _locationHeight).clamp(0.0, 1.0);
    return Container(
      color: AppColors.homeSkin,
      padding: EdgeInsets.only(top: topInset),
      child: Column(
        children: [
          ClipRect(
            child: Align(
              alignment: Alignment.topLeft,
              heightFactor: 1 - collapse,
              child: Opacity(
                opacity: 1 - collapse,
                child: const SizedBox(
                  height: _locationHeight,
                  child: LocationHeader(
                    padding: EdgeInsets.fromLTRB(
                        AppSpacing.gutter, 2, AppSpacing.gutter, 0),
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter, 4, AppSpacing.gutter, 10),
            child: D2KSearchField(rotating: true, onTap: onSearchTap),
          ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(_HomeHeaderDelegate oldDelegate) =>
      oldDelegate.topInset != topInset;
}

/// The dark "^ Back to top" pill the reference floats above the nav bar.
class BackToTopButton extends StatelessWidget {
  const BackToTopButton({
    super.key,
    required this.visible,
    required this.onTap,
  });

  final bool visible;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      ignoring: !visible,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 220),
        opacity: visible ? 1 : 0,
        child: Center(
          child: Material(
            color: const Color(0xFF20293A),
            borderRadius: BorderRadius.circular(AppRadius.pill),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.keyboard_arrow_up,
                        size: 18, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(
                      context.strings.backToTop,
                      style: AppTypography.buttonSmall
                          .copyWith(color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Convenience alias so other feeds can render an identical shelf.
class HomeProductShelf extends StatelessWidget {
  const HomeProductShelf({
    super.key,
    required this.title,
    required this.products,
    this.actionLabel,
    this.onAction,
    this.topPadding = AppSpacing.sectionGap,
    this.canvas,
  });

  final String title;
  final List<Product> products;
  final String? actionLabel;
  final VoidCallback? onAction;
  final double topPadding;
  final Color? canvas;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    return Container(
      color: canvas,
      padding: EdgeInsets.only(top: topPadding, bottom: canvas == null ? 0 : 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: title,
            actionLabel: actionLabel,
            onAction: onAction,
          ),
          HorizontalShelf(
            itemCount: products.length,
            itemBuilder: (context, index) =>
                ProductCard(product: products[index]),
          ),
        ],
      ),
    );
  }
}
