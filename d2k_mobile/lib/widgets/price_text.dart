import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';
import '../domain/models/product.dart';
import '../state/currency_controller.dart';

/// Renders "TZS 496,000  606,000  18%" — the reference price hierarchy.
///
/// Every monetary glyph in the app flows through here (or through
/// [CurrencyController] directly), so switching currency updates all of them.
class PriceRow extends StatelessWidget {
  const PriceRow({
    super.key,
    required this.product,
    this.priceStyle,
    this.showDiscount = true,
    this.wrap = false,
  });

  final Product product;
  final TextStyle? priceStyle;
  final bool showDiscount;
  final bool wrap;

  @override
  Widget build(BuildContext context) {
    final currency = context.watch<CurrencyController>();

    final price = Text(
      currency.format(product.price),
      style: priceStyle ?? AppTypography.price,
      maxLines: 1,
    );

    if (!product.hasDiscount) {
      return wrap
          ? price
          : Row(children: [Flexible(child: price)]);
    }

    final struck = Text(
      currency.formatBare(product.originalPriceBase!),
      style: AppTypography.priceStruck,
      maxLines: 1,
    );
    // A tag rather than bare text: the website badges the percentage, and a
    // tinted chip reads as a claim about the price instead of another number
    // competing with it.
    final discount = Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
      decoration: BoxDecoration(
        color: AppColors.saleSoft,
        borderRadius: BorderRadius.circular(AppRadius.xs),
      ),
      child: Text(
        '-${product.discountPercent}%',
        style: AppTypography.discount,
        maxLines: 1,
      ),
    );

    // Shilling amounts run long, so the strike-through original and the
    // discount drop to a second line rather than truncating the live price.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        price,
        const SizedBox(height: 2),
        Row(
          children: [
            Flexible(child: struck),
            if (showDiscount) ...[
              const SizedBox(width: 6),
              discount,
            ],
          ],
        ),
      ],
    );
  }
}

/// Price treatment used inside the flash-sale cards (orange, larger).
class FlashPriceRow extends StatelessWidget {
  const FlashPriceRow({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final currency = context.watch<CurrencyController>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          currency.format(product.price),
          maxLines: 1,
          style: AppTypography.price.copyWith(
            fontSize: 17,
            color: AppColors.flashOrange,
          ),
        ),
        if (product.hasDiscount) ...[
          const SizedBox(height: 2),
          Row(
            children: [
              Flexible(
                child: Text(
                  currency.formatBare(product.originalPriceBase!),
                  maxLines: 1,
                  style: AppTypography.priceStruck,
                ),
              ),
              const SizedBox(width: 6),
              Text('${product.discountPercent}%',
                  style: AppTypography.discount),
            ],
          ),
        ],
      ],
    );
  }
}
