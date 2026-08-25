import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';
import '../models/product.dart';
import 'primitives.dart';
import 'product_card.dart';
import 'product_grid.dart';
import 'states.dart';

/// A horizontally scrolling row of products.
///
/// The rail scrolls inside its own track — the page itself never moves
/// sideways, which is the same rule the website holds. It bleeds to the screen
/// edge so a phone can scroll a full-width row without a dead gutter on the
/// right, and the first card still starts on the page's own margin.
class ProductShelf extends StatelessWidget {
  const ProductShelf({
    super.key,
    required this.title,
    required this.products,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? subtitle;
  final List<ProductCardModel> products;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// 164px — wide enough for "Order from abroad" and a six-figure price
  /// without an ellipsis, narrow enough that a second card is always visible
  /// at the edge, which is what tells the eye the row scrolls.
  static const cardWidth = 164.0;

  /// The same arithmetic the grid uses, so a card is the same card in a shelf
  /// and in a grid rather than two subtly different ones.
  static double height(BuildContext context) =>
      ProductGrid.cardHeight(context, cardWidth);

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHead(
          title: title,
          subtitle: subtitle,
          actionLabel: actionLabel,
          onAction: onAction,
        ),
        SizedBox(
          height: height(context),
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: K.gutter),
            itemCount: products.length,
            physics: const BouncingScrollPhysics(),
            separatorBuilder: (_, _) => const SizedBox(width: ProductGrid.spacing),
            itemBuilder: (context, index) =>
                ProductCard(product: products[index], width: cardWidth),
          ),
        ),
      ],
    );
  }
}

/// The loading shape of a shelf.
class ProductShelfSkeleton extends StatelessWidget {
  const ProductShelfSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(K.gutter, 0, K.gutter, K.s12),
            child: Skeleton(width: 168, height: 18, radius: K.rXs),
          ),
          SizedBox(
            height: ProductShelf.height(context),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: K.gutter),
              itemCount: 4,
              physics: const NeverScrollableScrollPhysics(),
              separatorBuilder: (_, _) => const SizedBox(width: ProductGrid.spacing),
              itemBuilder: (_, _) => const SizedBox(
                width: ProductShelf.cardWidth,
                child: ProductCardSkeleton(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
