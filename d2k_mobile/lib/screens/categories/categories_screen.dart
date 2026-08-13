import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../domain/models/catalog.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../widgets/app_image.dart';
import '../../widgets/search_bar.dart';
import '../../widgets/states.dart';
import '../search/search_screen.dart';
import 'category_products_screen.dart';

/// Categories tab — search field, "Categories" title and the three-column
/// image tile grid from the reference.
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  late Future<List<Category>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<CatalogRepository>().categories();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<CatalogRepository>().categories());
    await _future;
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
                  AppSpacing.gutter, 8, AppSpacing.gutter, 12),
              child: D2KSearchField(
                elevated: false,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SearchScreen()),
                ),
              ),
            ),
            Expanded(
              child: FutureBuilder<List<Category>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const _CategoriesSkeleton();
                  }
                  if (snapshot.hasError) {
                    return StatusView.error(context, onRetry: _reload);
                  }
                  final categories = snapshot.data ?? const <Category>[];
                  if (categories.isEmpty) {
                    return StatusView(
                      icon: Icons.grid_view_rounded,
                      title: strings.nothingHere,
                    );
                  }
                  return RefreshIndicator(
                    onRefresh: _reload,
                    color: AppColors.primary,
                    child: CustomScrollView(
                      physics: const AlwaysScrollableScrollPhysics(
                          parent: BouncingScrollPhysics()),
                      slivers: [
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(
                                AppSpacing.gutter, 0, AppSpacing.gutter, 14),
                            child: Text(
                              strings.categories,
                              style: AppTypography.sectionTitle
                                  .copyWith(fontSize: 20),
                            ),
                          ),
                        ),
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(
                              AppSpacing.gutter, 0, AppSpacing.gutter, 28),
                          sliver: SliverGrid(
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 3,
                              mainAxisSpacing: 18,
                              crossAxisSpacing: 12,
                              childAspectRatio: 0.72,
                            ),
                            delegate: SliverChildBuilderDelegate(
                              (context, index) => _CategoryTile(
                                category: categories[index],
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => CategoryProductsScreen(
                                      category: categories[index],
                                    ),
                                  ),
                                ),
                              ),
                              childCount: categories.length,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category, required this.onTap});

  final Category category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: AppRadius.tile,
              child: AppImage(
                category.image,
                fit: BoxFit.contain,
                backgroundColor: AppColors.tileSurface,
                padding: const EdgeInsets.all(10),
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 34,
            child: Text(
              category.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.tileLabel.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: 13.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoriesSkeleton extends StatelessWidget {
  const _CategoriesSkeleton();

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter, 30, AppSpacing.gutter, 20),
      itemCount: 9,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 18,
        crossAxisSpacing: 12,
        childAspectRatio: 0.72,
      ),
      itemBuilder: (_, __) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Expanded(child: Skeleton(height: double.infinity, radius: 14)),
          SizedBox(height: 10),
          Skeleton(height: 12),
        ],
      ),
    );
  }
}
