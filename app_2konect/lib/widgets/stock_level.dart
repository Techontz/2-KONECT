import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import '../providers/language.dart';

/// How many are left, said the same way everywhere.
///
/// One widget for the card and the product page, so a shopper is never told
/// "3 left" in the grid and "In stock" on the page they open. The card's size
/// is a single line of small text that adds no height beyond the line it
/// occupies, because a card's vertical space is hard-won.
///
/// An import is bought to order, so a zero on hand is not an absence — the
/// caller passes [toOrder] and the count is replaced by the fact that it is
/// sourced rather than stocked. Saying "Out of stock" there would turn a
/// perfectly buyable product away.
class StockLevel extends ConsumerWidget {
  const StockLevel({
    super.key,
    required this.stock,
    this.toOrder = false,
    this.large = false,
  });

  final int stock;
  final bool toOrder;
  final bool large;

  /// The threshold the low-stock badge already uses, so the urgent wording and
  /// the urgent badge always agree.
  static const lowStock = 5;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final base = large
        ? const TextStyle(fontFamily: K.fontFamily, fontSize: 13, height: 1.4)
        : KType.meta;

    final (text, colour, weight) = _read(ref);

    return Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: base.copyWith(color: colour, fontWeight: weight),
    );
  }

  (String, Color, FontWeight) _read(WidgetRef ref) {
    if (toOrder) {
      return (ref.t('product.madeToOrder'), K.import, FontWeight.w500);
    }
    if (stock <= 0) {
      return (ref.t('product.outOfStock'), K.sale, FontWeight.w700);
    }
    if (stock <= lowStock) {
      return (
        stock == 1
            ? ref.t('product.onlyOneLeft')
            : ref.t('product.onlyLeftShort', {'count': stock}),
        K.warn,
        FontWeight.w700,
      );
    }
    return (
      ref.t('product.inStockCount', {'count': stock}),
      K.inkFaint,
      FontWeight.w500,
    );
  }
}
