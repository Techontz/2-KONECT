import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../models/catalog.dart';
import '../../../providers/language.dart';
import '../../../widgets/primitives.dart';

/// The category rail, as the home screen renders it.
///
/// Circular plates rather than square tiles: at this size a photograph reads
/// as a symbol, and a round crop keeps a strip of fourteen from looking like a
/// wall of unrelated rectangles.
class CategoryStrip extends ConsumerWidget {
  const CategoryStrip({super.key, required this.categories});

  final List<Category> categories;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (categories.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHead(
          title: ref.t('home.shopByCategory'),
          actionLabel: ref.t('common.seeAll'),
          onAction: () => context.push('/categories'),
        ),
        SizedBox(
          height: 104,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: categories.length,
            separatorBuilder: (_, _) => const SizedBox(width: K.s12),
            itemBuilder: (context, index) {
              final category = categories[index];
              return SizedBox(
                width: 72,
                child: InkWell(
                  onTap: () => context.push(
                    '/category/${category.id}?name=${Uri.encodeComponent(category.name)}',
                  ),
                  borderRadius: K.radius(K.rSm),
                  child: Column(
                    children: [
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: K.surface,
                          shape: BoxShape.circle,
                          border: Border.all(color: K.line),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: category.image == null
                            ? const Icon(Icons.category_outlined, size: 22, color: K.brand400)
                            : ProductImage(
                                url: category.image,
                                padding: const EdgeInsets.all(7),
                                decodeWidth: 120,
                              ),
                      ),
                      const SizedBox(height: K.s8),
                      Text(
                        category.name,
                        maxLines: 2,
                        textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10.5,
                          height: 1.25,
                          fontWeight: FontWeight.w700,
                          color: K.inkSoft,
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
