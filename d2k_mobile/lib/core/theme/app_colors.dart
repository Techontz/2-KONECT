import 'package:flutter/material.dart';

/// Colour tokens sampled directly from the reference recording.
///
/// The palette keeps the reference application's action colours (royal blue for
/// CTAs and the active navigation state) and swaps the reference brand yellow
/// for the Direct2Kariakoo brand yellow (`#FEC107`, taken from the D2K logo).
class AppColors {
  const AppColors._();

  // ---------------------------------------------------------------- brand
  /// D2K brand yellow — sampled from `assets/images/d2k_logo.png`.
  static const Color brandYellow = Color(0xFFFEE500);
  static const Color brandYellowDeep = Color(0xFFF5D500);
  static const Color brandBlack = Color(0xFF101010);

  // --------------------------------------------------------------- action
  /// Primary action blue — sampled from the "Add to cart" CTA (#3F63DD).
  static const Color primary = Color(0xFF3866DF);
  static const Color primaryDark = Color(0xFF2B52BD);
  static const Color primarySoft = Color(0xFFEEF3FF);
  static const Color chipSelected = Color(0xFF5061D7);

  // ----------------------------------------------------------- foreground
  static const Color textPrimary = Color(0xFF101010);
  static const Color textSecondary = Color(0xFF6B6B6B);
  static const Color textTertiary = Color(0xFF9A9A9A);
  static const Color textInverse = Color(0xFFFFFFFF);

  // ----------------------------------------------------------- background
  static const Color surface = Color(0xFFFFFFFF);
  static const Color scaffold = Color(0xFFF4F4F6);
  /// The tinted "seasonal skin" backdrop behind the top of the home feed.
  static const Color homeSkin = Color(0xFFD8EFFF);
  static const Color homeSkinDeep = Color(0xFFBFE4FF);
  static const Color tileSurface = Color(0xFFF1F1F9);
  static const Color divider = Color(0xFFE6E6E9);

  /// The heavier rule the website uses on inputs and outlined controls.
  static const Color lineStrong = Color(0xFFD2D2D8);

  /// Discount percentage — the website's --color-sale.
  static const Color sale = Color(0xFFE01A2B);
  static const Color saleSoft = Color(0xFFFDECEE);
  static const Color successSoft = Color(0xFFE6F4EE);
  static const Color chipSurface = Color(0xFFEDEBEE);

  // --------------------------------------------------------------- accent
  static const Color bestSeller = Color(0xFF11574C);
  static const Color discountGreen = Color(0xFF067D4E);
  static const Color ratingGreen = Color(0xFF0E8A3C);
  static const Color pinkBadge = Color(0xFFE01B62);
  static const Color rankPurple = Color(0xFF4C1D95);
  static const Color flashOrange = Color(0xFFE8500F);
  static const Color globalChip = Color(0xFFF0E9FA);

  // ------------------------------------------------------- section canvas
  static const Color megaDealsCanvas = Color(0xFFFFFBD5);
  static const Color flashSaleCanvas = Color(0xFFFFFFE1);
  static const Color backToSchoolCanvas = Color(0xFFE6DDFB);
  static const Color offerCanvasA = Color(0xFFE7F7FB);
  static const Color offerCanvasB = Color(0xFFFDF6E0);
  static const Color offerCanvasC = Color(0xFFFCE9F1);

  static const Color error = Color(0xFFD92D20);
  static const Color success = Color(0xFF12A150);
}
