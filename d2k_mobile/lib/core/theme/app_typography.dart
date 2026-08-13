import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Centralised type ramp. Sizes are derived from the reference recording
/// (390pt logical width), never chosen ad hoc at the call site.
class AppTypography {
  const AppTypography._();

  static const String family = 'JakartaSans';

  static const TextStyle _base = TextStyle(
    fontFamily: family,
    color: AppColors.textPrimary,
    height: 1.25,
    letterSpacing: -0.1,
  );

  /// Screen level headline — "Your shopping cart looks empty."
  static final TextStyle displayLarge =
      _base.copyWith(fontSize: 24, fontWeight: FontWeight.w800, height: 1.25);

  /// Product detail price.
  static final TextStyle priceHero =
      _base.copyWith(fontSize: 22, fontWeight: FontWeight.w800);

  /// "Categories", "Bestsellers", "Flash sale" — section + page titles.
  static final TextStyle sectionTitle =
      _base.copyWith(fontSize: 18, fontWeight: FontWeight.w800, height: 1.22);

  static final TextStyle sectionTitleSmall =
      _base.copyWith(fontSize: 16, fontWeight: FontWeight.w800);

  /// "VIEW ALL >" trailing action.
  static final TextStyle sectionAction = _base.copyWith(
    fontSize: 14,
    fontWeight: FontWeight.w700,
    color: AppColors.primary,
  );

  /// Product card title (2 lines, ellipsised).
  static final TextStyle productTitle =
      _base.copyWith(fontSize: 13.5, fontWeight: FontWeight.w500, height: 1.28);

  /// Product card price.
  static final TextStyle price =
      _base.copyWith(fontSize: 15.5, fontWeight: FontWeight.w800);

  static final TextStyle priceStruck = _base.copyWith(
    fontSize: 12.5,
    fontWeight: FontWeight.w500,
    color: AppColors.textTertiary,
    decoration: TextDecoration.lineThrough,
    decorationColor: AppColors.textTertiary,
  );

  static final TextStyle discount = _base.copyWith(
    fontSize: 12.5,
    fontWeight: FontWeight.w700,
    color: AppColors.discountGreen,
  );

  static final TextStyle rating =
      _base.copyWith(fontSize: 12.5, fontWeight: FontWeight.w700);

  static final TextStyle ratingCount = _base.copyWith(
    fontSize: 12.5,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  /// Meta rows — "#1 in Smartphones", "Selling out fast".
  static final TextStyle meta = _base.copyWith(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static final TextStyle metaMuted = _base.copyWith(
    fontSize: 12.5,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
    height: 1.35,
  );

  /// Small caps badges — "Best Seller", "FLAT 70% OFF".
  static final TextStyle badge = _base.copyWith(
    fontSize: 11.5,
    fontWeight: FontWeight.w700,
    color: AppColors.textInverse,
    letterSpacing: 0,
  );

  static final TextStyle expressPill = _base.copyWith(
    fontSize: 12,
    fontWeight: FontWeight.w800,
    fontStyle: FontStyle.italic,
    color: AppColors.brandBlack,
  );

  static final TextStyle button =
      _base.copyWith(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textInverse);

  static final TextStyle buttonSmall =
      _base.copyWith(fontSize: 13.5, fontWeight: FontWeight.w700);

  /// Bottom navigation label.
  static final TextStyle navLabel =
      _base.copyWith(fontSize: 12.5, fontWeight: FontWeight.w500);

  static final TextStyle navLabelActive = _base.copyWith(
    fontSize: 12.5,
    fontWeight: FontWeight.w600,
    color: AppColors.primary,
  );

  /// Category tile caption on the home grid / categories grid.
  static final TextStyle tileLabel =
      _base.copyWith(fontSize: 13, fontWeight: FontWeight.w600, height: 1.25);

  static final TextStyle searchHint = _base.copyWith(
    fontSize: 16,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  static final TextStyle body =
      _base.copyWith(fontSize: 14, fontWeight: FontWeight.w500, height: 1.45);

  static final TextStyle bodyStrong =
      _base.copyWith(fontSize: 14.5, fontWeight: FontWeight.w700);

  static final TextStyle caption = _base.copyWith(
    fontSize: 11.5,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );
}
