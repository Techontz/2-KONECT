/// Environment configuration.
///
/// Production is the default so a release build cannot accidentally ship
/// pointing at a laptop. Development overrides it at launch:
///
///     flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8001/api
///
/// (10.0.2.2 is the host machine as seen from the Android emulator; a physical
/// handset needs the laptop's LAN address and `php artisan serve --host=0.0.0.0`.)
class Env {
  const Env._();

  /// The production storefront API. Never localhost.
  static const String defaultApiBaseUrl = 'https://api.2konect.shop/api';

  static const String apiBaseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: defaultApiBaseUrl);

  /// The website, used for share links and legal pages.
  static const String siteUrl =
      String.fromEnvironment('SITE_URL', defaultValue: 'https://www.2konect.shop');

  static bool get isProduction => apiBaseUrl == defaultApiBaseUrl;

  /* --- Timeouts ---------------------------------------------------------
     Generous rather than tight: the production origin regularly answers a
     cold catalogue request in 3–7 seconds and a 10-second ceiling would turn
     a slow home screen into a failed one. */
  static const Duration connectTimeout = Duration(seconds: 20);
  static const Duration receiveTimeout = Duration(seconds: 40);
}
