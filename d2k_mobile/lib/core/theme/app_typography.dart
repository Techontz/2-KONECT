import 'package:flutter/material.dart';

import 'app_colors.dart';

/// D2K's type system.
///
/// The family is **Manrope** — the same face the website uses. Matching it is
/// the single change that does most to make the app and the site read as one
/// brand: Manrope's geometric-humanist shapes and, more importantly, its
/// tabular-feeling numerals make prices look deliberate rather than incidental.
///
/// Two rules hold everything together:
///
///  * **One family, intentional weights.** 400/500/600/700/800 only, and heavy
///    weights are reserved for things that genuinely lead — prices, section
///    titles, buttons. Bolding everything is what made the old screens read as
///    loud rather than premium.
///  * **Fallbacks are declared, not assumed.** Manrope covers Latin, so
///    English, Swahili and French are safe; it has no CJK glyphs, so Chinese
///    falls through to the platform's Noto CJK. Without the explicit fallback
///    Chinese renders as tofu boxes.
class AppTypography {
  const AppTypography._();

  static const String family = 'Manrope';

  /// Manrope has no CJK coverage; the platform's Noto faces do.
  static const List<String> fallback = [
    'Noto Sans SC',
    'Noto Sans CJK SC',
    'PingFang SC',
    'Heiti SC',
    'sans-serif',
  ];

  static const TextStyle _base = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    letterSpacing: 0,
  );

  // ------------------------------------------------------------- display --
  /// Onboarding and empty-state headlines. Tight tracking keeps a large size
  /// from looking airy.
  static const TextStyle displayLarge = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    fontSize: 27,
    height: 1.2,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.6,
  );

  // --------------------------------------------------------------- money --
  /// The hero price on a product page. The largest number in the app, and the
  /// one people actually came to read.
  static const TextStyle priceHero = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    // Manrope sets wider than the previous face, so the hero price keeps its
    // old 22pt rather than growing: the new numerals already carry more weight
    // at the same size, and 24pt overflowed a 360pt screen.
    fontSize: 22,
    height: 1.1,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.7,
  );

  /// Price on a card. Slightly negative tracking stops long shilling amounts
  /// from sprawling across a 2-up grid.
  static const TextStyle price = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    fontSize: 15.5,
    height: 1.15,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.4,
  );

  /// The old price. Muted and struck — present, but never competing.
  static const TextStyle priceStruck = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textTertiary,
    fontSize: 12,
    height: 1.2,
    fontWeight: FontWeight.w500,
    decoration: TextDecoration.lineThrough,
    decorationColor: AppColors.textTertiary,
  );

  /// The discount percentage. The website renders this as a sale-toned tag, so
  /// it is red here too — green is reserved for savings and in-stock, exactly
  /// as the web tokens split them.
  static const TextStyle discount = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.sale,
    fontSize: 12,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );

  // ------------------------------------------------------------ headings --
  static const TextStyle sectionTitle = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    // 16pt, not 17: section titles share a row with a "View all" action, and
    // Manrope's wider setting pushed that pairing past a 360pt screen.
    fontSize: 16,
    height: 1.25,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.35,
  );

  static const TextStyle sectionTitleSmall = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    fontSize: 15,
    height: 1.3,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
  );

  /// "View all" — a quiet action beside a loud heading.
  static const TextStyle sectionAction = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.primary,
    fontSize: 12.5,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );

  // ------------------------------------------------------------ products --
  /// Product names run to two lines on a card, so this trades size for
  /// readability rather than shouting.
  static const TextStyle productTitle = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    fontSize: 13,
    height: 1.35,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle rating = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    fontSize: 12,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle ratingCount = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textTertiary,
    fontSize: 11.5,
    height: 1.2,
    fontWeight: FontWeight.w500,
  );

  // ---------------------------------------------------------------- body --
  static const TextStyle body = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    fontSize: 14,
    height: 1.5,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle bodyStrong = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    fontSize: 14,
    height: 1.4,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.1,
  );

  static const TextStyle meta = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textSecondary,
    fontSize: 12.5,
    height: 1.4,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle metaMuted = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textTertiary,
    fontSize: 12,
    height: 1.4,
    fontWeight: FontWeight.w500,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textTertiary,
    fontSize: 11,
    height: 1.35,
    fontWeight: FontWeight.w500,
  );

  // ------------------------------------------------------------- badges ---
  static const TextStyle badge = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textInverse,
    fontSize: 10.5,
    height: 1.1,
    fontWeight: FontWeight.w800,
    letterSpacing: 0.2,
  );

  static const TextStyle expressPill = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.brandBlack,
    fontSize: 10,
    height: 1.1,
    fontWeight: FontWeight.w800,
    letterSpacing: 0.3,
  );

  // ------------------------------------------------------------ controls --
  static const TextStyle button = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textInverse,
    fontSize: 15,
    height: 1.2,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.1,
  );

  static const TextStyle buttonSmall = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textInverse,
    fontSize: 13,
    height: 1.2,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle searchHint = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textTertiary,
    fontSize: 14,
    height: 1.3,
    fontWeight: FontWeight.w500,
  );

  // ---------------------------------------------------------- navigation --
  /// Tab labels sit at 10.5pt so a long Swahili or French word still fits a
  /// fifth of a 320pt screen without ellipsising.
  static const TextStyle navLabel = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textTertiary,
    fontSize: 10.5,
    height: 1.15,
    fontWeight: FontWeight.w600,
  );

  static const TextStyle navLabelActive = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.primary,
    fontSize: 10.5,
    height: 1.15,
    fontWeight: FontWeight.w800,
  );

  static const TextStyle tileLabel = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    color: AppColors.textPrimary,
    fontSize: 11.5,
    height: 1.25,
    fontWeight: FontWeight.w600,
  );

  /// The base every ad-hoc `TextStyle` in a widget should copy from.
  static TextStyle get base => _base;
}
