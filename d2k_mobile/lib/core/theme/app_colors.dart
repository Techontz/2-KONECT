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
  static const Color brandYellow = Color(0xFFFEC107);
  static const Color brandYellowDeep = Color(0xFFF2A900);
  static const Color brandBlack = Color(0xFF0F0F10);

  // --------------------------------------------------------------- action
  /// Primary action blue — sampled from the "Add to cart" CTA (#3F63DD).
  static const Color primary = Color(0xFF3F63DD);
  static const Color primaryDark = Color(0xFF2C4BC4);
  static const Color primarySoft = Color(0xFFEBF2FF);
  static const Color chipSelected = Color(0xFF5061D7);

  // ----------------------------------------------------------- foreground
  static const Color textPrimary = Color(0xFF111827);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textTertiary = Color(0xFF9AA0AB);
  static const Color textInverse = Color(0xFFFFFFFF);

  // ----------------------------------------------------------- background
  static const Color surface = Color(0xFFFFFFFF);
  static const Color scaffold = Color(0xFFF5F4FA);
  /// The tinted "seasonal skin" backdrop behind the top of the home feed.
  static const Color homeSkin = Color(0xFFD8EFFF);
  static const Color homeSkinDeep = Color(0xFFBFE4FF);
  static const Color tileSurface = Color(0xFFF1F1F9);
  static const Color divider = Color(0xFFECECF1);
  static const Color chipSurface = Color(0xFFEDEBEE);

  // --------------------------------------------------------------- accent
  static const Color bestSeller = Color(0xFF11574C);
  static const Color discountGreen = Color(0xFF1FAD3E);
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
