import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/l10n/app_strings.dart';
import 'core/theme/app_theme.dart';
import 'data/api_client.dart';
import 'data/remote_catalog_source.dart';
import 'data/remote_chat_source.dart';
import 'data/remote_shop_source.dart';
import 'domain/repositories/catalog_repository.dart';
import 'screens/onboarding/splash_screen.dart';
import 'state/app_controllers.dart';
import 'state/auth_controller.dart';
import 'state/cart_controller.dart';
import 'state/currency_controller.dart';
import 'state/vendor_controller.dart';

class D2KApp extends StatelessWidget {
  const D2KApp({super.key, this.api});

  /// Test seam. Production always builds its own client against the real
  /// backend; a test can pass one wired to a canned transport so widget tests
  /// do not need a live server. Nothing else about the app changes.
  final ApiClient? api;

  @override
  Widget build(BuildContext context) {
    // One client for the whole app: it owns the base URL and the bearer token,
    // so every controller shares a single session.
    final api = this.api ?? ApiClient();

    // The catalogue is the Laravel API. Nothing is bundled with the app.
    final catalog = CatalogRepository(RemoteCatalogSource(api));
    final shop = RemoteShopSource(api);
    final chat = RemoteChatSource(api);

    return MultiProvider(
      providers: [
        Provider<CatalogRepository>.value(value: catalog),
        Provider<ApiClient>.value(value: api),
        Provider<RemoteShopSource>.value(value: shop),
        Provider<RemoteChatSource>.value(value: chat),
        ChangeNotifierProvider(create: (_) => AuthController(api)..restore()),
        ChangeNotifierProvider(create: (_) => VendorController(api)),
        ChangeNotifierProvider(create: (_) => CurrencyController()),
        ChangeNotifierProvider(create: (_) => CartController(catalog)),
        ChangeNotifierProvider(create: (_) => WishlistController(catalog)),
        ChangeNotifierProvider(create: (_) => LocationController(shop)),
        ChangeNotifierProvider(create: (_) => AppSettingsController()),
        ChangeNotifierProvider(create: (_) => BrowsingHistoryController(catalog)),
      ],
      child: Consumer<AppSettingsController>(
        builder: (context, settings, _) {
          return MaterialApp(
            title: 'Direct2Kariakoo',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            locale: settings.language.locale,
            builder: (context, child) {
              // Keep the layout faithful to the reference regardless of the
              // device's accessibility text scale.
              final media = MediaQuery.of(context);
              return MediaQuery(
                data: media.copyWith(
                  textScaler: media.textScaler.clamp(
                    minScaleFactor: 0.9,
                    maxScaleFactor: 1.15,
                  ),
                ),
                child: StringsScope(
                  strings: AppStrings(settings.language),
                  child: child ?? const SizedBox.shrink(),
                ),
              );
            },
            home: const SplashScreen(),
          );
        },
      ),
    );
  }
}
