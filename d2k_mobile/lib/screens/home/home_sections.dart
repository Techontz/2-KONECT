import 'package:flutter/material.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../domain/models/product.dart';
import '../../widgets/product_card.dart';
import '../../widgets/section_header.dart';

/// Feature strips for the deals screen.
///
/// These are presentation only: they render whatever list of real products they
/// are handed. The sections that used to build their own contents from a
/// bundled sample catalogue are gone — the backend decides what is on offer.

/// A dark, full-bleed band highlighting the deepest discounts.
class MegaDealsSection extends StatelessWidget {
  const MegaDealsSection({
    super.key,
    required this.products,
    this.onAllDeals,
  });

  final List<Product> products;
  final VoidCallback? onAllDeals;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    final strings = context.strings;

    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.sectionGap),
      padding: const EdgeInsets.symmetric(vertical: 18),
      color: AppColors.brandBlack,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter, 0, AppSpacing.gutter, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    strings.allDeals,
                    style: AppTypography.sectionTitle.copyWith(
                      color: AppColors.brandYellow,
                    ),
                  ),
                ),
                if (onAllDeals != null)
                  TextButton(
                    onPressed: onAllDeals,
                    child: Text(
                      strings.viewAll,
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ),
              ],
            ),
          ),
          HorizontalShelf(
            itemCount: products.length,
            itemBuilder: (context, index) =>
                ProductCard(product: products[index]),
          ),
        ],
      ),
    );
  }
}

/// The steepest reductions currently live, with the real units-left figure.
class FlashSaleSection extends StatelessWidget {
  const FlashSaleSection({
    super.key,
    required this.products,
    this.onViewAll,
  });

  final List<Product> products;
  final VoidCallback? onViewAll;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    final strings = context.strings;

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sectionGap),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: strings.deals,
            actionLabel: strings.viewAll,
            onAction: onViewAll,
          ),
          HorizontalShelf(
            itemCount: products.length,
            itemBuilder: (context, index) =>
                ProductCard(product: products[index]),
          ),
        ],
      ),
    );
  }
}
