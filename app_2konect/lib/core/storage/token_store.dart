import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Where the Sanctum token lives.
///
/// The Keychain on iOS and EncryptedSharedPreferences on Android — never plain
/// preferences, because a bearer token is the whole session. The cached user
/// profile sits beside it so the app can render a signed-in shell on the first
/// frame instead of flashing "sign in" while `/api/me` is in flight.
class TokenStore {
  TokenStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
            );

  final FlutterSecureStorage _storage;

  static const _tokenKey = '2konect.token';
  static const _userKey = '2konect.user';

  String? _cachedToken;

  /// The token held in memory, for the request interceptor's hot path.
  String? get cachedToken => _cachedToken;

  Future<String?> read() async {
    try {
      _cachedToken = await _storage.read(key: _tokenKey);
    } on Exception {
      // A device with a broken keystore should browse as a guest, not crash.
      _cachedToken = null;
    }
    return _cachedToken;
  }

  Future<void> write(String token) async {
    _cachedToken = token;
    try {
      await _storage.write(key: _tokenKey, value: token);
    } on Exception {
      // Kept in memory for this session at least.
    }
  }

  Future<void> clear() async {
    _cachedToken = null;
    try {
      await _storage.delete(key: _tokenKey);
      await _storage.delete(key: _userKey);
    } on Exception {
      /* nothing recoverable to do */
    }
  }

  Future<String?> readUser() async {
    try {
      return await _storage.read(key: _userKey);
    } on Exception {
      return null;
    }
  }

  Future<void> writeUser(String json) async {
    try {
      await _storage.write(key: _userKey, value: json);
    } on Exception {
      /* nothing recoverable to do */
    }
  }
}
