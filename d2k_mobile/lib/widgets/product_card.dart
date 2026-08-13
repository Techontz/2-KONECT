import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/l10n/app_strings.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';
import '../domain/models/product.dart';
import '../screens/product/product_detail_screen.dart';
import '../state/app_controllers.dart';
import '../state/cart_controller.dart';
import 'add_to_cart_button.dart';
import 'app_image.dart';
import 'badges.dart';
import 'favourite_button.dart';
import 'price_text.dart';

/// The single product card implementation used everywhere in D2K —
/// home shelves, search results, category grids, deals, cart recommendations.
///
/// Layout, proportions and stacking order are taken from the reference:
/// image plate with the Best Seller flag top-left, heart top-right and the
/// white add button bottom-right, then title → rating → price → rank/sold →
/// express pill.
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.width = AppSizes.productCardWidth,
    this.showMetaRow = true,
    this.showExpress = true,
    this.dense = false,
  });

  /// Card variant used inside a fixed-width grid cell.
  const ProductCard.grid({
    super.key,
    required this.product,
    this.showMetaRow = true,
    this.showExpress = true,
    this.dense = false,
  }) : width = double.infinity;

  final Product product;
  final double width;
  final bool showMetaRow;
  final bool showExpress;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width == double.infinity ? null : width,
      child: Material(
        color: AppColors.surface,
        borderRadius: AppRadius.card,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => ProductDetailScreen.open(context, product),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _ImagePlate(product: product),
              Padding(
                padding: EdgeInsets.fromLTRB(8, 8, 8, dense ? 8 : 10),
                child: _Details(
                  product: product,
                  showMetaRow: showMetaRow,
                  showExpress: showExpress,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ImagePlate extends StatelessWidget {
  const _ImagePlate({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    return AspectRatio(
      aspectRatio: AppSizes.productImageRatio,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AppImage(
            product.primaryImage,
            fit: BoxFit.contain,
            backgroundColor: AppColors.surface,
            padding: const EdgeInsets.all(10),
          ),
          if (product.isBestSeller)
            Positioned(
              top: 8,
              left: 0,
              child: BestSellerFlag(label: strings.bestSeller),
            ),
          if (product.isSponsored)
            const Positioned(
              left: 8,
              bottom: 8,
              child: _AdTag(),
            ),
          Positioned(
            top: 4,
            right: 4,
            child: FavouriteButton(productId: product.id),
          ),
          Positioned(
            right: 6,
            bottom: 6,
            child: AddToCartButton(product: product),
          ),
        ],
      ),
    );
  }
}

class _AdTag extends StatelessWidget {
  const _AdTag();

  @override
  Widget build(BuildContext context) => Text(
        'Ad',
        style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
      );
}

class _Details extends StatelessWidget {
  const _Details({
    required this.product,
    required this.showMetaRow,
    required this.showExpress,
  });

  final Product product;
  final bool showMetaRow;
  final bool showExpress;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 36,
          child: Text(
            product.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.productTitle,
          ),
        ),
        const SizedBox(height: 5),
        RatingRow(rating: product.rating, reviewCount: product.reviewCount),
        const SizedBox(height: 5),
        SizedBox(
          height: 38,
          child: Align(
            alignment: Alignment.topLeft,
            child: PriceRow(product: product),
          ),
        ),
        if (showMetaRow) ...[
          const SizedBox(height: 6),
          SizedBox(
            height: 16,
            child: _MetaLine(product: product),
          ),
        ],
        if (showExpress) ...[
          const SizedBox(height: 8),
          SizedBox(
            height: 20,
            child: Align(
              alignment: Alignment.centerLeft,
              child: product.isGlobal
                  ? const GlobalPill()
                  : product.isExpress
                      ? ExpressPill(label: strings.express)
                      : const SizedBox.shrink(),
            ),
          ),
        ],
      ],
    );
  }
}

class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    if (product.soldRecently != null) {
      return SoldRecentlyBadge(label: product.soldRecently!);
    }
    if (product.rankLabel != null) {
      return RankBadge(label: product.rankLabel!);
    }
    if (product.stock > 0 && product.stock <= 10) {
      // Same flex + ellipsis treatment as the two badge variants above, so a
      // longer translation or a larger text scale cannot overflow the card.
      return Row(
        children: [
          const Icon(Icons.local_fire_department,
              size: 14, color: AppColors.flashOrange),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              context.strings.sellingOutFast,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.meta,
            ),
          ),
        ],
      );
    }
    return const SizedBox.shrink();
  }
}

/// Compact horizontal row used in the cart and wishlist.
class ProductRowCard extends StatelessWidget {
  const ProductRowCard({
    super.key,
    required this.product,
    this.trailing,
    this.subtitle,
    this.onTap,
  });

  final Product product;
  final Widget? trailing;
  final Widget? subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.card,
      child: InkWell(
        borderRadius: AppRadius.card,
        onTap: onTap ?? () => ProductDetailScreen.open(context, product),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.sm),
                child: AppImage(
                  product.primaryImage,
                  width: 84,
                  height: 84,
                  backgroundColor: AppColors.surface,
                  padding: const EdgeInsets.all(4),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.productTitle,
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 4),
                      subtitle!,
                    ],
                    const SizedBox(height: 6),
                    PriceRow(product: product),
                    if (trailing != null) ...[
                      const SizedBox(height: 10),
                      trailing!,
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Cart badge count helper shared by the nav bar and product page.
int cartCount(BuildContext context) => context.watch<CartController>().itemCount;

/// Wishlist count helper.
int wishlistCount(BuildContext context) =>
    context.watch<WishlistController>().count;
