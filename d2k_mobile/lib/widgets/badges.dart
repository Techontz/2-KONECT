import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';

/// Dark-teal "Best Seller" flag pinned to the top-left of a product image.
/// Square on the left edge, rounded on the right — exactly as in the reference.
class BestSellerFlag extends StatelessWidget {
  const BestSellerFlag({super.key, required this.label, this.color});

  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color ?? AppColors.bestSeller,
        borderRadius: const BorderRadius.only(
          topRight: Radius.circular(AppRadius.sm),
          bottomRight: Radius.circular(AppRadius.sm),
        ),
      ),
      child: Text(label, style: AppTypography.badge),
    );
  }
}

/// Yellow italic "express" pill under the price block.
class ExpressPill extends StatelessWidget {
  const ExpressPill({super.key, this.label = 'express'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
      decoration: BoxDecoration(
        color: AppColors.brandYellow,
        borderRadius: BorderRadius.circular(AppRadius.xs),
      ),
      child: Text(label, style: AppTypography.expressPill),
    );
  }
}

/// Lilac "Global" pill shown instead of express on imported stock.
class GlobalPill extends StatelessWidget {
  const GlobalPill({super.key, this.label = 'Global'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.globalChip,
        borderRadius: BorderRadius.circular(AppRadius.xs),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.public, size: 12, color: AppColors.rankPurple),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTypography.meta.copyWith(fontSize: 11.5),
          ),
        ],
      ),
    );
  }
}

/// Pink promotional capsule used on the home tile grid ("FLAT 70% OFF").
class PromoCapsule extends StatelessWidget {
  const PromoCapsule({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.pinkBadge,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTypography.badge.copyWith(fontSize: 9.5),
      ),
    );
  }
}

/// Purple rosette + rank text ("#1 in Smartphones").
class RankBadge extends StatelessWidget {
  const RankBadge({super.key, required this.label, this.maxLines = 1});

  final String label;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 15,
          height: 15,
          decoration: const BoxDecoration(
            color: AppColors.rankPurple,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.star, size: 9, color: Colors.white),
        ),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            label,
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.meta,
          ),
        ),
      ],
    );
  }
}

/// Green cart glyph + "50+ sold recently".
class SoldRecentlyBadge extends StatelessWidget {
  const SoldRecentlyBadge({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.shopping_cart,
            size: 13, color: AppColors.discountGreen),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.meta,
          ),
        ),
      ],
    );
  }
}

/// Star + rating + review count row used on cards and the product page.
class RatingRow extends StatelessWidget {
  const RatingRow({
    super.key,
    required this.rating,
    required this.reviewCount,
    this.compact = true,
  });

  final double rating;
  final int reviewCount;
  final bool compact;

  static String formatCount(int count) {
    if (count >= 1000) {
      final k = count / 1000;
      return '${k.toStringAsFixed(k >= 10 ? 0 : 1)}K';
    }
    return '$count';
  }

  @override
  Widget build(BuildContext context) {
    // Shrink-wraps so the row can also sit inside width-unbounded parents
    // (the pill on the product page, chips, sheets).
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star, size: 14, color: AppColors.ratingGreen),
        const SizedBox(width: 3),
        Text(rating.toStringAsFixed(1), style: AppTypography.rating),
        const SizedBox(width: 4),
        Text(
          compact ? '(${formatCount(reviewCount)})' : '($reviewCount ratings)',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.ratingCount,
        ),
      ],
    );
  }
}

/// Small dark capsule pinned to the bottom of a flash-sale card.
class StockRibbon extends StatelessWidget {
  const StockRibbon({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 10),
      color: AppColors.brandBlack,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.timelapse, size: 13, color: Colors.white),
          const SizedBox(width: 6),
          Text(label, style: AppTypography.badge.copyWith(fontSize: 12)),
        ],
      ),
    );
  }
}
