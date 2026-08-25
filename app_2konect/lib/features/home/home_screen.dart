import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/theme/tokens.dart';
import '../../models/catalog.dart';
import '../../providers/catalog.dart';
import '../../providers/language.dart';
import '../../widgets/primitives.dart';
import '../../widgets/product_shelf.dart';
import '../../widgets/states.dart';
import '../../widgets/store_app_bar.dart';
import 'widgets/hero_carousel.dart';
import 'widgets/category_strip.dart';
import 'widgets/quick_entries.dart';
import 'language_prompt.dart';

/// The home screen.
///
/// It reproduces the website's homepage as a mobile hierarchy rather than as a
/// stack of every desktop section: the first screenful has to say what 2KONECT
/// is — search it, browse it, and buy it here or from abroad — before anything
/// else competes for attention.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  void initState() {
    super.initState();
    // Asked once, on the first launch, and never again.
    WidgetsBinding.instance.addPostFrameCallback((_) => maybeAskForLanguage(context, ref));
  }

  @override
  Widget build(BuildContext context) {
    final feed = ref.watch(homeFeedProvider);

    return Scaffold(
      appBar: const StoreAppBar(),
      body: RefreshIndicator(
        color: K.brand,
        onRefresh: () async => ref.refresh(homeFeedProvider.future),
        child: feed.when(
          loading: () => const _HomeSkeleton(),
          error: (error, _) => ListView(
            children: [
              SizedBox(height: MediaQuery.sizeOf(context).height * 0.18),
              ErrorState(error: error, onRetry: () => ref.invalidate(homeFeedProvider)),
            ],
          ),
          data: (data) => _HomeBody(feed: data),
        ),
      ),
    );
  }
}

class _HomeBody extends ConsumerWidget {
  const _HomeBody({required this.feed});

  final HomeFeed feed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (feed.isEmpty) {
      return ListView(
        children: [
          SizedBox(height: MediaQuery.sizeOf(context).height * 0.16),
          EmptyState(
            icon: Icons.storefront_outlined,
            title: ref.t('listing.noResults'),
            message: ref.t('common.offline'),
            actionLabel: ref.t('common.retry'),
            onAction: () => ref.invalidate(homeFeedProvider),
          ),
        ],
      );
    }

    // Every section is separated by exactly one gap, which is what gives a
    // long home screen a pulse instead of a drift.
    const gap = SizedBox(height: K.gapSection);

    return ListView(
      padding: const EdgeInsets.only(bottom: K.s28),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        // `hero` is the campaign rail. `hero_side` is deliberately not shown
        // on a phone — the website hides it below `lg` because on a small
        // screen it would push the category strip and the first products off
        // the fold, and those are what a shopper came for.
        if (feed.hero.isNotEmpty) ...[
          const SizedBox(height: K.s12),
          HeroCarousel(banners: feed.hero),
        ] else
          const SizedBox(height: K.s12),

        // The two ways to buy, stated immediately — this is what 2KONECT is.
        const SizedBox(height: K.s20),
        const QuickEntries(),

        if (feed.categories.isNotEmpty) ...[
          gap,
          CategoryStrip(categories: feed.categories),
        ],

        if (feed.deals.isNotEmpty) ...[
          gap,
          ProductShelf(
            title: ref.t('home.dealsTitle'),
            subtitle: ref.t('home.dealsSubtitle'),
            products: feed.deals,
            actionLabel: ref.t('common.seeAll'),
            onAction: () => context.push(
              '/shop?on_sale=1&title=${Uri.encodeComponent(ref.read(tProvider)('nav.deals'))}',
            ),
          ),
        ],

        if (feed.local.isNotEmpty) ...[
          gap,
          ProductShelf(
            title: ref.t('home.availableIn', {'country': Brand.country}),
            subtitle: ref.t('nav.readyInDays'),
            products: feed.local,
            actionLabel: ref.t('common.seeAll'),
            onAction: () => context.push(
              '/shop?availability=local&title=${Uri.encodeComponent(ref.read(tProvider)('nav.inCountry', {'country': Brand.country}))}',
            ),
          ),
        ],

        if (feed.imports.isNotEmpty) ...[
          gap,
          ProductShelf(
            title: ref.t('home.fromAbroadShort'),
            subtitle: ref.t('nav.lowerPriceImport'),
            products: feed.imports,
            actionLabel: ref.t('common.seeAll'),
            onAction: () => context.push(
              '/shop?availability=import&title=${Uri.encodeComponent(ref.read(tProvider)('nav.fromAbroad'))}',
            ),
          ),
        ],

        if (feed.collections.isNotEmpty)
          for (final collection in feed.collections) ...[
            gap,
            _CollectionRow(collection: collection),
          ],

        if (feed.verified.isNotEmpty) ...[
          gap,
          ProductShelf(
            title: ref.t('home.localSellers'),
            subtitle: ref.t('home.localSellersHint', {'country': Brand.country}),
            products: feed.verified,
            actionLabel: ref.t('common.seeAll'),
            onAction: () => context.push('/shop?verified=1'),
          ),
        ],

        for (final shelf in feed.shelves) ...[
          gap,
          ProductShelf(
            title: shelf.title,
            products: shelf.products,
            actionLabel: ref.t('common.seeAll'),
            onAction: () => context.push('/shop?title=${Uri.encodeComponent(shelf.title)}'),
          ),
        ],

        gap,
        const _RequestBanner(),
      ],
    );
  }
}

/// "Shop the category" tiles, as placed by an administrator.
class _CollectionRow extends ConsumerWidget {
  const _CollectionRow({required this.collection});

  final CategoryCollection collection;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (collection.tiles.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHead(title: collection.title),
        SizedBox(
          height: 128,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: collection.tiles.length,
            separatorBuilder: (_, _) => const SizedBox(width: K.s10),
            itemBuilder: (context, index) {
              final tile = collection.tiles[index];
              return SizedBox(
                width: 108,
                child: Panel(
                  padding: EdgeInsets.zero,
                  onTap: () => context.push(
                    '/shop?subcategory=${tile.id}&title=${Uri.encodeComponent(tile.name)}',
                  ),
                  child: Column(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.vertical(top: Radius.circular(K.rMd)),
                          child: SizedBox.expand(
                            child: ProductImage(
                              url: tile.image,
                              padding: const EdgeInsets.all(8),
                              decodeWidth: 140,
                            ),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(7, 5, 7, 8),
                        child: Column(
                          children: [
                            Text(
                              tile.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: K.ink,
                              ),
                            ),
                            Text(
                              ref.t('listing.productCount', {'count': tile.productCount}),
                              style: const TextStyle(fontSize: 10, color: K.inkFaint),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Cannot find it? 2KONECT will source it. The single most 2KONECT thing on
/// the screen, so it closes the home experience rather than hiding in a menu.
class _RequestBanner extends ConsumerWidget {
  const _RequestBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Panel(
        color: K.brand,
        border: Border.all(color: K.brand),
        padding: const EdgeInsets.all(18),
        onTap: () => context.push('/request'),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    ref.t('request.heroTitle'),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: K.s6),
                  Text(
                    ref.t('request.heroBody', {'country': Brand.country}),
                    style: const TextStyle(fontSize: 12.5, height: 1.45, color: K.brand300),
                  ),
                ],
              ),
            ),
            const SizedBox(width: K.s12),
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.12),
                borderRadius: K.radius(K.rSm),
              ),
              child: const Icon(Icons.travel_explore_rounded, color: Colors.white, size: 20),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonScope(
      child: SingleChildScrollView(
        physics: NeverScrollableScrollPhysics(),
        padding: EdgeInsets.only(top: K.s14, bottom: K.s28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // The hero, at the artwork's own 1200/400 aspect, so nothing
            // shifts when the real plate arrives.
            Padding(
              padding: EdgeInsets.symmetric(horizontal: K.s12),
              child: AspectRatio(
                aspectRatio: HeroCarousel.aspect,
                child: Skeleton(radius: K.rLg, height: double.infinity),
              ),
            ),
            SizedBox(height: K.s20),
            // The two ways to buy.
            Padding(
              padding: EdgeInsets.symmetric(horizontal: K.gutter),
              child: Row(
                children: [
                  Expanded(child: Skeleton(height: 92, radius: K.rMd)),
                  SizedBox(width: K.s10),
                  Expanded(child: Skeleton(height: 92, radius: K.rMd)),
                ],
              ),
            ),
            SizedBox(height: K.gapSection),
            _CategoryStripSkeleton(),
            SizedBox(height: K.gapSection),
            ProductShelfSkeleton(),
          ],
        ),
      ),
    );
  }
}

/// The category rail's loading shape — round plates, as the real one has.
class _CategoryStripSkeleton extends StatelessWidget {
  const _CategoryStripSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(K.gutter, 0, K.gutter, K.s12),
          child: Skeleton(width: 150, height: 18, radius: K.rXs),
        ),
        SizedBox(
          height: 104,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: K.gutter),
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 5,
            separatorBuilder: (_, _) => const SizedBox(width: K.s12),
            itemBuilder: (_, _) => const Column(
              children: [
                Skeleton(width: 60, height: 60, radius: 30),
                SizedBox(height: K.s8),
                Skeleton(width: 52, height: 9),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
