import '../core/network/api_client.dart';
import '../models/account.dart';
import '../models/json.dart';

/// The result of signing in: who, and the Sanctum token that proves it.
class AuthSession {
  const AuthSession({required this.user, required this.token});

  final AuthUser user;
  final String token;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
        user: AuthUser.fromJson(asMap(json['user'])),
        token: asString(json['token']),
      );
}

/// Registration, sign-in, Google, and reading the current account.
///
/// One architecture, the website's: Firebase (when Google is used) proves
/// identity, Laravel issues the Sanctum token, and every subsequent request in
/// the app carries that token. Nothing here invents a second session.
class AuthService {
  const AuthService(this._api);

  final ApiClient _api;

  Future<AuthSession> login({required String email, required String password}) async {
    final data = await _api.post<Map<String, dynamic>>('/login', body: {
      'email': email.trim(),
      'password': password,
    });
    return AuthSession.fromJson(data);
  }

  Future<AuthSession> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    required String passwordConfirmation,
  }) async {
    final data = await _api.post<Map<String, dynamic>>('/register', body: {
      'name': name.trim(),
      'email': email.trim(),
      'phone': phone.trim(),
      'password': password,
      'password_confirmation': passwordConfirmation,
      // The app registers shoppers. Becoming a seller is a separate
      // application an administrator reviews, exactly as on the website.
      'role': 'user',
    });
    return AuthSession.fromJson(data);
  }

  /// Exchanges a Firebase ID token for a Sanctum token.
  ///
  /// The server verifies the token against the Firebase project itself — this
  /// app never asserts who the customer is, it only relays what Google signed.
  Future<AuthSession> google(String idToken) async {
    final data = await _api.post<Map<String, dynamic>>('/auth/google', body: {
      'id_token': idToken,
    });
    return AuthSession.fromJson(data);
  }

  Future<AuthUser> me() async {
    final data = await _api.get<Map<String, dynamic>>('/me');
    return AuthUser.fromJson(data);
  }

  Future<void> logout() => _api.post<dynamic>('/logout');
}
