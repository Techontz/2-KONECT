import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/network/api_client.dart';
import '../core/storage/token_store.dart';
import '../services/account_service.dart';
import '../services/auth_service.dart';
import '../services/catalog_service.dart';
import '../services/commerce_service.dart';
import '../services/seller_service.dart';

/// Set once at launch, after `SharedPreferences` has been opened, so every
/// consumer reads preferences synchronously rather than through a FutureProvider
/// that would make the first frame of every screen a spinner.
final preferencesProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('preferencesProvider must be overridden in main()'),
);

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(tokens: ref.watch(tokenStoreProvider));
});

final catalogServiceProvider =
    Provider<CatalogService>((ref) => CatalogService(ref.watch(apiClientProvider)));

final commerceServiceProvider =
    Provider<CommerceService>((ref) => CommerceService(ref.watch(apiClientProvider)));

final accountServiceProvider =
    Provider<AccountService>((ref) => AccountService(ref.watch(apiClientProvider)));

final authServiceProvider =
    Provider<AuthService>((ref) => AuthService(ref.watch(apiClientProvider)));

final sellerServiceProvider =
    Provider<SellerService>((ref) => SellerService(ref.watch(apiClientProvider)));
