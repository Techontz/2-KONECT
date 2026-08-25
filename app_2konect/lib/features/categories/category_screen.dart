import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/tokens.dart';
import '../../models/catalog.dart';
import '../../providers/catalog.dart';
import '../../providers/language.dart';
import '../../widgets/product_shelf.dart';
import '../../widgets/states.dart';

/// One category: its subcategories, the shelves an administrator curated for
/// it, and then the full grid.
class CategoryScreen extends ConsumerWidget {
  const CategoryScreen({super.key, required this.categoryId, this.name});

  final int categoryId;
  final String? name;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(categoryPageProvider(categoryId));

    return Scaffold(
      appBar: AppBar(
        title: Text(page.valueOrNull?.category.name ?? name ?? ref.t('nav.categories')),
        actions: [
          IconButton(
            onPressed: () => context.push('/search'),
            icon: const Icon(Icons.search_rounded),
          ),
        ],
      ),
      body: page.when(
        loading: () => const ProductShelfSkeleton(),
        error: (error, _) => ErrorState(
          error: error,
          onRetry: () => ref.invalidate(categoryPageProvider(categoryId)),
        ),
        data: (data) => ListView(
          padding: const EdgeInsets.only(top: 14, bottom: 24),
          children: [
            if (data.subcategories.isNotEmpty)
              SizedBox(
                height: 36,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  itemCount: data.subcategories.length,
                  separatorBuilder: (_, _) => const SizedBox(width: K.s8),
                  itemBuilder: (context, index) {
                    final sub = data.subcategories[index];
                    return Material(
                      color: K.surface,
                      borderRadius: K.radius(K.rPill),
                      child: InkWell(
                        onTap: () => context.push(
                          '/shop?subcategory=${sub.id}&title=${Uri.encodeComponent(sub.name)}',
                        ),
                        borderRadius: K.radius(K.rPill),
                        child: Ink(
                          decoration: BoxDecoration(
                            borderRadius: K.radius(K.rPill),
                            border: K.hairline,
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 13),
                          child: Center(
                            child: Text(
                              sub.name,
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: K.inkSoft,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),

            for (final shelf in data.shelves) ...[
              const SizedBox(height: K.gapSection),
              ProductShelf(title: shelf.title, products: shelf.products),
            ],

            const SizedBox(height: K.gapSection),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  // The full grid is its own screen rather than a list nested
                  // inside this one: a category with 2,000 products needs its
                  // own scroll position, its own filters and its own paging.
                  onPressed: () => context.push(
                    '/shop?category=$categoryId'
                    '&title=${Uri.encodeComponent(data.category.name)}',
                  ),
                  child: Text(
                    ref.t('listing.showCount', {'count': _total(data)}),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// How many products the category page already knows about, for the button's
  /// label. The listing screen re-reads the real total from the server.
  static int _total(CategoryPage page) =>
      page.subcategories.fold(0, (sum, sub) => sum + sub.productCount);
}
