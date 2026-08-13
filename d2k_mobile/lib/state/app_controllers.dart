import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/l10n/app_strings.dart';
import '../data/promo_data.dart';
import '../domain/models/commerce.dart';
import '../domain/models/location.dart';
import '../data/remote_shop_source.dart';
import '../domain/models/product.dart';
import '../domain/repositories/catalog_repository.dart';

/// Saved products (heart control on every product card).
class WishlistController extends ChangeNotifier {
  WishlistController(this._catalog);

  final CatalogRepository _catalog;
  static const String _prefsKey = 'd2k.wishlist';

  final Set<String> _ids = <String>{};

  Set<String> get ids => Set.unmodifiable(_ids);
  int get count => _ids.length;
  bool contains(String productId) => _ids.contains(productId);

  List<Product> get products => _ids
      .map(_catalog.productById)
      .whereType<Product>()
      .toList(growable: false);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _ids
      ..clear()
      ..addAll(prefs.getStringList(_prefsKey) ?? const []);
    notifyListeners();
  }

  /// Returns true when the product ended up saved.
  bool toggle(String productId) {
    final added = _ids.add(productId);
    if (!added) _ids.remove(productId);
    notifyListeners();
    _persist();
    return added;
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_prefsKey, _ids.toList());
  }
}

/// Country + delivery address selection.
///
/// Saved addresses come from the backend's `addresses` table — the same one
/// the website writes to. There is no local address book.
class LocationController extends ChangeNotifier {
  LocationController(this._shop);

  final RemoteShopSource _shop;

  static const String _countryKey = 'd2k.country';
  static const String _areaKey = 'd2k.area';
  static const String _cityKey = 'd2k.city';
  static const String _onboardedKey = 'd2k.onboarded';

  ShippingCountry _country = PromoData.countries.first;
  DeliveryLocation _location = DeliveryLocation.kariakoo;
  bool _onboarded = false;

  ShippingCountry get country => _country;
  DeliveryLocation get location => _location;
  bool get onboarded => _onboarded;

  List<Address> _addresses = const [];
  bool _loadingAddresses = false;
  Object? _addressError;

  List<Address> get savedAddresses => _addresses;
  bool get loadingAddresses => _loadingAddresses;
  Object? get addressError => _addressError;

  Address? get defaultAddress {
    for (final address in _addresses) {
      if (address.isDefault) return address;
    }
    return _addresses.isEmpty ? null : _addresses.first;
  }

  /// Pulls the account's addresses. Only meaningful when signed in; the
  /// backend rejects the request otherwise and the list stays empty.
  Future<void> loadAddresses() async {
    _loadingAddresses = true;
    _addressError = null;
    notifyListeners();

    try {
      _addresses = await _shop.addresses();
    } catch (error) {
      _addresses = const [];
      _addressError = error;
    } finally {
      _loadingAddresses = false;
      notifyListeners();
    }
  }

  Future<Address> saveAddress(AddressDraft draft, {String? id}) async {
    final saved = id == null
        ? await _shop.createAddress(draft)
        : await _shop.updateAddress(id, draft);
    await loadAddresses();
    return saved;
  }

  Future<void> removeAddress(String id) async {
    await _shop.deleteAddress(id);
    await loadAddresses();
  }

  Future<void> makeDefault(String id) async {
    await _shop.makeDefaultAddress(id);
    await loadAddresses();
  }

  /// Clears the address book on sign-out so the next account never sees the
  /// previous one's saved places.
  void forgetAddresses() {
    _addresses = const [];
    _addressError = null;
    notifyListeners();
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_countryKey);
    if (code != null) {
      _country = PromoData.countries.firstWhere(
        (c) => c.code == code,
        orElse: () => PromoData.countries.first,
      );
    }
    final area = prefs.getString(_areaKey);
    final city = prefs.getString(_cityKey);
    _location = DeliveryLocation(
      label: 'Other',
      area: area ?? DeliveryLocation.kariakoo.area,
      city: city ?? DeliveryLocation.kariakoo.city,
      countryName: _country.name,
    );
    _onboarded = prefs.getBool(_onboardedKey) ?? false;
    notifyListeners();
  }

  Future<void> selectCountry(ShippingCountry country) async {
    _country = country;
    _location = _location.copyWith(
      countryName: country.name,
      city: country.cities.first,
    );
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_countryKey, country.code);
    await prefs.setString(_cityKey, _location.city);
  }

  Future<void> setLocation({required String area, required String city}) async {
    _location = _location.copyWith(area: area, city: city);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_areaKey, area);
    await prefs.setString(_cityKey, city);
  }

  Future<void> completeOnboarding() async {
    _onboarded = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_onboardedKey, true);
  }
}

/// Language and device preferences.
///
/// Identity deliberately does not live here. The signed-in account is whatever
/// [AuthController] obtained from the backend; a second, locally-invented user
/// object used to sit alongside it and could report someone as logged in when
/// the server disagreed.
class AppSettingsController extends ChangeNotifier {
  static const String _langKey = 'd2k.language';

  // Kiswahili is the preferred language for a Tanzanian marketplace.
  AppLanguage _language = AppLanguage.swahili;
  bool _notificationsEnabled = true;

  AppLanguage get language => _language;
  bool get notificationsEnabled => _notificationsEnabled;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _language = AppLanguage.fromCode(prefs.getString(_langKey));
    notifyListeners();
  }

  Future<void> setLanguage(AppLanguage language) async {
    if (_language == language) return;
    _language = language;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_langKey, language.code);
  }

  void setNotifications(bool value) {
    _notificationsEnabled = value;
    notifyListeners();
  }

}

/// Recent searches + recently viewed products.
class BrowsingHistoryController extends ChangeNotifier {
  BrowsingHistoryController(this._catalog);

  final CatalogRepository _catalog;
  static const String _searchKey = 'd2k.recentSearches';
  static const String _viewedKey = 'd2k.recentlyViewed';
  static const int _limit = 10;

  final List<String> _searches = [];
  final List<String> _viewedIds = [];

  List<String> get recentSearches => List.unmodifiable(_searches);

  List<Product> get recentlyViewed => _viewedIds
      .map(_catalog.productById)
      .whereType<Product>()
      .toList(growable: false);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _searches
      ..clear()
      ..addAll(prefs.getStringList(_searchKey) ?? const []);
    _viewedIds
      ..clear()
      ..addAll(prefs.getStringList(_viewedKey) ?? const []);
    notifyListeners();
  }

  void recordSearch(String query) {
    final q = query.trim();
    if (q.isEmpty) return;
    _searches
      ..removeWhere((s) => s.toLowerCase() == q.toLowerCase())
      ..insert(0, q);
    if (_searches.length > _limit) _searches.removeRange(_limit, _searches.length);
    notifyListeners();
    _persist();
  }

  void recordView(String productId) {
    _viewedIds
      ..remove(productId)
      ..insert(0, productId);
    if (_viewedIds.length > _limit) {
      _viewedIds.removeRange(_limit, _viewedIds.length);
    }
    notifyListeners();
    _persist();
  }

  void clearSearches() {
    _searches.clear();
    notifyListeners();
    _persist();
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_searchKey, _searches);
    await prefs.setStringList(_viewedKey, _viewedIds);
  }
}
