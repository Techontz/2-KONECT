import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/tokens.dart';
import '../../providers/catalog.dart';
import '../../providers/language.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// Every category, with its subcategories one tap away.
///
/// The tree comes from the backend — nothing here is a hard-coded list, so a
/// category an administrator adds appears without a release.
class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('nav.allCategories'))),
      body: categories.when(
        loading: () => ListView.separated(
          padding: const EdgeInsets.all(14),
          itemCount: 8,
          separatorBuilder: (_, _) => const SizedBox(height: K.s10),
          itemBuilder: (_, _) => const Skeleton(height: 62, radius: K.rMd),
        ),
        error: (error, _) =>
            ErrorState(error: error, onRetry: () => ref.invalidate(categoriesProvider)),
        data: (data) => data.isEmpty
            ? EmptyState(icon: Icons.category_outlined, title: ref.t('listing.noResults'))
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                itemCount: data.length,
                separatorBuilder: (_, _) => const SizedBox(height: K.s10),
                itemBuilder: (context, index) {
                  final category = data[index];
                  return Panel(
                    padding: EdgeInsets.zero,
                    child: ExpansionTile(
                      shape: const Border(),
                      collapsedShape: const Border(),
                      tilePadding: const EdgeInsets.symmetric(horizontal: 12),
                      childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      leading: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: K.brand50,
                          borderRadius: K.radius(K.rSm),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: category.image == null
                            ? const Icon(Icons.category_outlined, size: 20, color: K.brand400)
                            : ProductImage(
                                url: category.image,
                                padding: const EdgeInsets.all(5),
                                decodeWidth: 100,
                              ),
                      ),
                      title: Text(
                        category.name,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        ref.t('listing.productCount', {'count': category.productCount}),
                        style: const TextStyle(fontSize: 11.5, color: K.inkFaint),
                      ),
                      // A category with no children is a destination, not a
                      // drawer — tapping it should open the products.
                      onExpansionChanged: category.subcategories.isEmpty
                          ? (_) => context.push(
                                '/category/${category.id}?name=${Uri.encodeComponent(category.name)}',
                              )
                          : null,
                      children: [
                        Wrap(
                          spacing: 7,
                          runSpacing: 7,
                          children: [
                            _Pill(
                              label: ref.t('common.seeAll'),
                              onTap: () => context.push(
                                '/category/${category.id}?name=${Uri.encodeComponent(category.name)}',
                              ),
                              primary: true,
                            ),
                            for (final sub in category.subcategories)
                              _Pill(
                                label: sub.name,
                                onTap: () => context.push(
                                  '/shop?subcategory=${sub.id}&title=${Uri.encodeComponent(sub.name)}',
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.onTap, this.primary = false});

  final String label;
  final VoidCallback onTap;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: primary ? K.brand : K.surfaceAlt,
      borderRadius: K.radius(K.rPill),
      child: InkWell(
        onTap: onTap,
        borderRadius: K.radius(K.rPill),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: K.radius(K.rPill),
            border: Border.all(color: primary ? K.brand : K.line),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: primary ? Colors.white : K.inkSoft,
            ),
          ),
        ),
      ),
    );
  }
}
