/// Brand identity, in one place — the Dart mirror of `2k-web/lib/brand.ts`.
///
/// The app renders its name from here, so the whole product changes name by
/// editing this file and nothing else.
class Brand {
  const Brand._();

  static const name = '2KONECT';

  /// Short form used where space is tight. Never a substitute for the name in
  /// prose: the brand is 2KONECT, and "KONECT" on its own is a different word.
  static const short = '2K';
  static const tagline = 'Connect to what you need.';
  static const country = 'Tanzania';
  static const city = 'Dar es Salaam';
  static const currency = 'TZS';
  static const supportEmail = 'support@2konect.com';
  static const supportPhone = '+255 764 224 477';

  /// The official first-party seller, shown as the platform's own storefront.
  static const officialSeller = '2KONECT Official';

  static const markWhite = 'assets/brand/mark-white.png';
  static const markBrand = 'assets/brand/mark-brand.png';
  static const icon = 'assets/brand/icon-512.png';
}
