import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import '../models/product.dart';
import '../providers/cart.dart';
import '../providers/catalog.dart';
import '../providers/language.dart';
import '../providers/wishlist.dart';
import 'availability.dart';
import 'primitives.dart';
import 'stock_level.dart';

/// The single product card used by every grid, shelf and carousel.
///
/// Its job is to answer four questions before the shopper has to think: what is
/// it, what does it cost, where is it, and when would it arrive. It follows the
/// website's card structure exactly, because that structure was arrived at by
/// argument and is worth keeping:
///
/// ```
///   ┌──────────────────────┐
///   │  photograph          │  square, white, object-contain
///   │  ♡              (+)  │  wishlist top-right, add bottom-right
///   ├──────────────────────┤
///   │ 🇨🇳 China · 7–14 days │  full-width tinted band, hairline top & bottom
///   ├──────────────────────┤
///   │ Product name over    │  12.5px medium, two lines
///   │ two lines            │
///   │ 4.8★ (12)            │  only when it has reviews
///   │ TZS 2,700,000        │  the second-loudest thing on the card
///   │ 3,450,000  −22%      │
///   │ Only 1 left          │
///   │ Seller name       ✓  │  pushed to the bottom, so rows finish level
///   └──────────────────────┘
/// ```
///
/// Nothing in the details block reserves space for something that is not
/// there: the title takes one line or two as the name requires, and the rating
/// renders only when it exists. Cards in a row still finish level, because the
/// grid stretches them and the seller line collects the slack at the *bottom*
/// rather than in the middle.
class ProductCard extends ConsumerStatefulWidget {
  const ProductCard({super.key, required this.product, this.width});

  final ProductCardModel product;

  /// Set inside a horizontal shelf; null inside a grid, where the cell decides.
  final double? width;

  @override
  ConsumerState<ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends ConsumerState<ProductCard> {
  bool _justAdded = false;

  void _open() {
    // Hand the product screen the copy this card is already holding, so it
    // paints the photograph, name and price on its first frame.
    ref.read(productPreviewProvider.notifier).seed(widget.product);
    context.push('/product/${widget.product.id}');
  }

  void _add() {
    if (!widget.product.buyable) return;
    ref.read(cartProvider.notifier).add(widget.product);
    setState(() => _justAdded = true);
    Future<void>.delayed(const Duration(milliseconds: 1400), () {
      if (mounted) setState(() => _justAdded = false);
    });
  }

  Future<void> _toggleWishlist() async {
    try {
      await ref.read(wishlistProvider.notifier).toggle(widget.product.id);
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(content: Text(ref.read(tProvider)('common.somethingWrong'))),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final saved = ref.watch(wishlistProvider).has(product.id);
    final inCart = ref.watch(cartProvider.notifier).quantityOf(product.id);

    final card = Material(
      color: K.surface,
      borderRadius: K.radius(K.rMd),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: _open,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: K.radius(K.rMd),
            border: K.hairline,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              _plate(product, saved, inCart),
              AvailabilityStrip(sourcing: product.sourcing),
              // Expanded, not min: the grid stretches every cell to the tallest
              // in its row, and this is what lets the seller line drop to the
              // bottom instead of leaving a hole above it.
              Expanded(child: _details(product)),
            ],
          ),
        ),
      ),
    );

    return widget.width == null ? card : SizedBox(width: widget.width, child: card);
  }

  /* ---- the photograph, and the two controls that live over it ---- */

  Widget _plate(ProductCardModel product, bool saved, int inCart) {
    return AspectRatio(
      // Square, always. A card must never change height because of its image.
      aspectRatio: 1,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(
            color: Colors.white,
            child: ProductImage(
              url: product.image,
              padding: const EdgeInsets.all(K.s12),
              decodeWidth: 260,
            ),
          ),

          // Badges sit over the plate, never over the text block. At most two,
          // and the discount always wins the top slot.
          Positioned(
            left: K.s8,
            top: K.s8,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (product.badges.discounted && (product.price.discountPercent ?? 0) > 0)
                  DiscountChip(product.price.discountPercent!, solid: true),
                if (product.sourcing.isLocal && product.badges.outOfStock) ...[
                  const SizedBox(height: K.s4),
                  Tag(ref.t('product.soldOut'), tone: Tone.dark),
                ],
              ],
            ),
          ),

          // 44px, the comfortable-tap floor the website itself honours. Frosted
          // white so it reads over a dark photograph as well as a pale one.
          Positioned(
            right: K.s4,
            top: K.s4,
            child: _PlateButton(
              onTap: _toggleWishlist,
              tooltip: ref.t(saved ? 'product.removeFromWishlist' : 'product.saveToWishlist'),
              background: Colors.white.withValues(alpha: 0.92),
              child: AnimatedSwitcher(
                duration: K.fast,
                transitionBuilder: (child, animation) =>
                    ScaleTransition(scale: animation, child: child),
                child: Icon(
                  saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  key: ValueKey(saved),
                  size: 17,
                  color: saved ? K.sale : K.ink,
                ),
              ),
            ),
          ),

          // Add-to-cart as a compact navy disc rather than a full-width button.
          // It costs the card no vertical space at all, which is what buys the
          // room for the stock and seller lines beneath.
          if (product.buyable)
            Positioned(
              right: K.s4,
              bottom: K.s4,
              child: _PlateButton(
                onTap: _add,
                tooltip: ref.t('product.addToCart'),
                background: _justAdded ? K.success : K.brand,
                shadow: true,
                child: AnimatedSwitcher(
                  duration: K.fast,
                  transitionBuilder: (child, animation) =>
                      ScaleTransition(scale: animation, child: child),
                  child: Icon(
                    _justAdded ? Icons.check_rounded : Icons.add_rounded,
                    key: ValueKey(_justAdded),
                    size: 19,
                    color: Colors.white,
                  ),
                ),
              ),
            ),

          if (inCart > 0)
            Positioned(
              left: K.s8,
              bottom: K.s8,
              child: Tag(
                ref.t('app.inCart', {'count': inCart}),
                tone: Tone.dark,
              ),
            ),
        ],
      ),
    );
  }

  /* ---- what it is, what it costs, who is selling it ---- */

  Widget _details(ProductCardModel product) {
    final hasReviews = product.rating.hasReviews;
    final vendor = product.vendor;

    return Padding(
      padding: const EdgeInsets.fromLTRB(K.s10, K.s10, K.s10, K.s10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            product.name,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: KType.cardTitle,
          ),

          const SizedBox(height: K.s8),
          PriceBlock(
            price: product.price,
            size: 16,
            fromLabel: product.priceFrom ? ref.t('product.from') : null,
          ),

          // Rating, stock and the bulk hint share one row.
          //
          // The website gives the rating a line of its own, but it is working
          // in a wider grid; on a phone that line costs a card ~27px whether
          // or not the product has ever been reviewed, and the space shows as
          // a hole above the seller. Together they read as one metadata line —
          // "4.8★ (12) · 45 in stock" — which is denser and, on a tile this
          // size, easier to scan than two.
          const SizedBox(height: K.s6),
          Row(
            children: [
              // Every part of this row can shrink. Three facts on one line at
              // 148px is the tightest the card ever gets, and something has to
              // be allowed to give — otherwise a well-reviewed bulk product
              // pushes the row past the card's edge.
              if (hasReviews) ...[
                Flexible(child: RatingPill(rating: product.rating, showCount: true)),
                const _MetaDot(),
              ],
              Flexible(
                child: StockLevel(
                  stock: product.stock,
                  // An import is bought to order, so a zero on hand is not an
                  // absence — it is how the product is sold.
                  toOrder: product.stock <= 0 && product.sourcing.isImport,
                ),
              ),
              // At most two facts on this line, and never three. A 148px card
              // cannot hold a rating, a stock count and a bulk hint without one
              // of them being cut to nonsense — so the least useful of the
              // three gives up its place rather than all three being squeezed.
              // Bulk pricing still gets a table of its own on the product page.
              if (product.hasBulkPricing && !hasReviews) ...[
                const _MetaDot(),
                Flexible(
                  child: Text(
                    ref.t('productForm.bulkPricing'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: KType.meta.copyWith(
                      color: K.brand600,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ],
          ),

          if (vendor != null) ...[
            // The slack in a stretched cell collects here, at the bottom of the
            // card, rather than opening a gap between the name and the price —
            // which is the most important adjacency on the whole tile.
            const Spacer(),
            Padding(
              padding: const EdgeInsets.only(top: K.s8),
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      vendor.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: KType.meta,
                    ),
                  ),
                  if (vendor.isVerified) ...[
                    const SizedBox(width: 3),
                    const VerifiedBadge(size: 11),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The separator between two facts on the metadata line.
class _MetaDot extends StatelessWidget {
  const _MetaDot();

  @override
  Widget build(BuildContext context) => const SizedBox(
        width: 13,
        child: Center(
          child: Text('·', maxLines: 1, overflow: TextOverflow.clip, style: KType.meta),
        ),
      );
}

/// A circular control floating over the photograph.
///
/// 44×44 without exception — the comfortable-tap floor — with the glyph itself
/// sized to look right rather than to fill it.
class _PlateButton extends StatelessWidget {
  const _PlateButton({
    required this.child,
    required this.onTap,
    required this.background,
    this.tooltip,
    this.shadow = false,
  });

  final Widget child;
  final VoidCallback onTap;
  final Color background;
  final String? tooltip;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final button = DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: shadow
            ? const [BoxShadow(color: Color(0x3D1B2C3E), blurRadius: 12, offset: Offset(0, 4))]
            : K.shadowCard,
      ),
      child: Material(
        color: background,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: SizedBox(width: 40, height: 40, child: Center(child: child)),
        ),
      ),
    );

    // The visual disc is 40px; the padded tap target around it is 44.
    final tappable = Padding(padding: const EdgeInsets.all(2), child: button);

    return tooltip == null ? tappable : Tooltip(message: tooltip!, child: tappable);
  }
}
