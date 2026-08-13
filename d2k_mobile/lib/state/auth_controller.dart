import 'package:flutter/foundation.dart';

import '../data/api_client.dart';

enum AccountRole { customer, vendor, admin }

/// The signed-in account, as the backend describes it.
@immutable
class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.phone,
    this.vendorId,
    this.businessName,
    this.vendorApproved = false,
  });

  final int id;
  final String name;
  final String email;
  final AccountRole role;
  final String? phone;
  final int? vendorId;
  final String? businessName;
  final bool vendorApproved;

  bool get isVendor => role == AccountRole.vendor;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final source = (json['user'] as Map<String, dynamic>?) ?? json;
    final vendor = source['vendor'] as Map?;

    return AuthUser(
      id: (source['id'] as num?)?.toInt() ?? 0,
      name: '${source['name'] ?? ''}',
      email: '${source['email'] ?? ''}',
      phone: source['phone'] as String?,
      role: switch ('${source['role']}') {
        'vendor' => AccountRole.vendor,
        'admin' => AccountRole.admin,
        _ => AccountRole.customer,
      },
      vendorId: (vendor?['id'] as num?)?.toInt(),
      businessName: vendor?['business_name'] as String?,
      // The column is a tinyint, so it arrives as 1/0 as often as true/false.
      vendorApproved: vendor?['is_approved'] == true || vendor?['is_approved'] == 1,
    );
  }
}

/// Authentication state for the app.
///
/// Browsing is always available signed-out; this only gates the actions that
/// genuinely need an identity (checkout, orders, wishlist sync, the whole
/// seller experience).
class AuthController extends ChangeNotifier {
  AuthController(this._api);

  final ApiClient _api;

  AuthUser? _user;
  bool _restoring = true;
  String? _error;

  AuthUser? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isVendor => _user?.isVendor ?? false;
  bool get restoring => _restoring;
  String? get error => _error;

  /// Re-establish a saved session at start-up, if the token still works.
  Future<void> restore() async {
    _restoring = true;
    notifyListeners();

    try {
      await _api.restore();
      if (_api.isAuthenticated) {
        _user = AuthUser.fromJson(await _api.get('/me'));
      }
    } catch (_) {
      // A stale or revoked token simply means "browse as a guest".
      await _api.setToken(null);
      _user = null;
    } finally {
      _restoring = false;
      notifyListeners();
    }
  }

  Future<bool> login({required String email, required String password}) async {
    return _run(() async {
      final body = await _api.post('/login', {
        'email': email.trim(),
        'password': password,
      });
      await _adopt(body);
    });
  }

  /// Register as a shopper or as a seller.
  ///
  /// The role is chosen during onboarding and passed straight through — the
  /// backend owns what a vendor account means, including whether the store is
  /// approved, so nothing about that rule is reimplemented here.
  Future<bool> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    required AccountRole role,
    String? businessName,
  }) async {
    return _run(() async {
      final body = await _api.post('/register', {
        'name': name.trim(),
        'email': email.trim(),
        'phone': phone.trim(),
        'password': password,
        'password_confirmation': password,
        'role': role == AccountRole.vendor ? 'vendor' : 'user',
        if (role == AccountRole.vendor && businessName != null)
          'business_name': businessName.trim(),
      });
      await _adopt(body);
    });
  }

  Future<void> logout() async {
    try {
      await _api.post('/logout');
    } catch (_) {
      // Best effort — the local session goes either way.
    }
    await _api.setToken(null);
    _user = null;
    notifyListeners();
  }

  void clearError() {
    if (_error == null) return;
    _error = null;
    notifyListeners();
  }

  Future<void> _adopt(Map<String, dynamic> body) async {
    final token = body['token'] ?? body['access_token'];
    if (token is String && token.isNotEmpty) {
      await _api.setToken(token);
    }
    _user = AuthUser.fromJson(body);
  }

  Future<bool> _run(Future<void> Function() action) async {
    _error = null;
    notifyListeners();

    try {
      await action();
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'We could not reach the server. Check your connection.';
    }

    notifyListeners();
    return false;
  }
}
