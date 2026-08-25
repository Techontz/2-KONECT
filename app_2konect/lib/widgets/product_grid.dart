import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';
import '../models/product.dart';
import 'product_card.dart';
import 'states.dart';

/// The one grid geometry the whole app uses.
///
/// Declared once so search, category, shop, wishlist and the seller's own
/// listings can never drift apart. Two columns on every phone and three on a
/// large one, driven by the width a card needs to stay legible rather than by
/// a hard column count.
///
/// The height is derived, not written down. A card is a square plate, a 27px
/// availability band and a details block whose height depends on the type
/// scale — so it is computed from the cell width and the current text scale
/// instead of a magic number that silently clips the moment somebody enlarges
/// their system font.
class ProductGrid {
  const ProductGrid._();

  /// The widest a card may be before the grid adds another column.
  static const maxCardWidth = 220.0;

  static const spacing = K.s10;

  /// The availability band: 11px bold on a 7px vertical padding, plus its two
  /// hairlines.
  static const bandHeight = 27.0;

  /// The parts of the details block that never change size: the block's own
  /// padding, and the gaps between its rows.
  static const _detailsPadding = 20.0;
  static const _detailsGaps = 25.0;

  /// The parts that *do* scale with the reader's text size — two title lines,
  /// a price, a struck original, one metadata line and the seller.
  ///
  /// Sized for the **worst** card rather than the common one. Anything shorter
  /// leaves slack, which the card collects at the bottom behind the seller
  /// line rather than opening a hole between the name and the price — the
  /// most important adjacency on the tile. Sizing for the common case would
  /// overflow the moment a product earned its first review.
  ///
  /// The figure carries a few pixels of margin on purpose. It is verified by
  /// `test/product_card_test.dart` against every awkward shape the catalogue
  /// produces, at 0.9×, 1×, 1.15× and 1.3× text — and the margin is what
  /// stops a font metric changing between Flutter releases from turning a
  /// card into an overflow stripe.
  static const _detailsText = 114.0;

  /// The details block at 1× text.
  static const detailsHeight = _detailsPadding + _detailsGaps + _detailsText;

  /// The height a card needs at this width and text scale.
  ///
  /// Scaling the *whole* block by the text scale is wrong in both directions:
  /// it under-allocates below 1× — padding does not shrink with the type —
  /// and wastes space above it. Only the text scales.
  static double cardHeight(BuildContext context, double width) {
    // A card that fits at 1× must still fit at 1.3×, which is where the app
    // clamps, and at 0.9×, which is where a reader who wants more on screen
    // will put it.
    final scale = MediaQuery.textScalerOf(context).scale(14) / 14;
    return width + bandHeight + _detailsPadding + _detailsGaps + _detailsText * scale;
  }

  static SliverGridDelegate delegate(BuildContext context) {
    return SliverGridDelegateWithMaxCrossAxisExtent(
      maxCrossAxisExtent: maxCardWidth,
      mainAxisSpacing: spacing,
      crossAxisSpacing: spacing,
      mainAxisExtent: cardHeight(context, _cellWidth(context)),
    );
  }

  static double _cellWidth(BuildContext context) {
    final available = MediaQuery.sizeOf(context).width - K.s12 * 2;
    final columns = (available / maxCardWidth).ceil().clamp(2, 4);
    return (available - spacing * (columns - 1)) / columns;
  }

  static const padding = EdgeInsets.fromLTRB(K.s12, K.s12, K.s12, K.s24);
}

/// A grid of products, paged by the caller.
class ProductGridView extends StatelessWidget {
  const ProductGridView({
    super.key,
    required this.products,
    this.controller,
    this.loadingMore = false,
    this.physics,
    this.padding,
  });

  final List<ProductCardModel> products;
  final ScrollController? controller;
  final bool loadingMore;
  final ScrollPhysics? physics;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: GridView.builder(
        controller: controller,
        padding: padding ?? ProductGrid.padding,
        physics: physics ?? const AlwaysScrollableScrollPhysics(),
        gridDelegate: ProductGrid.delegate(context),
        itemCount: products.length + (loadingMore ? 2 : 0),
        itemBuilder: (context, index) => index >= products.length
            ? const ProductCardSkeleton()
            : ProductCard(product: products[index]),
      ),
    );
  }
}

/// The loading shape of a grid.
class ProductGridSkeleton extends StatelessWidget {
  const ProductGridSkeleton({super.key, this.count = 6});

  final int count;

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: GridView.builder(
        padding: ProductGrid.padding,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: ProductGrid.delegate(context),
        itemCount: count,
        itemBuilder: (_, _) => const ProductCardSkeleton(),
      ),
    );
  }
}
