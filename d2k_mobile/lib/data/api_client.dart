import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// HTTP client for the Direct2Kariakoo backend.
///
/// The Laravel API is the source of truth for the whole ecosystem — the same
/// endpoints the website calls. This client owns the base URL, the bearer
/// token and error translation so no screen ever builds a request by hand.
class ApiClient {
  ApiClient({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ?? defaultBaseUrl,
        _client = client ?? http.Client();

  /// Overridable at build time:
  /// `flutter run --dart-define=D2K_API=https://api.example.com/api`
  static const String defaultBaseUrl = String.fromEnvironment(
    'D2K_API',
    // The iOS simulator and desktop share the host's loopback; a physical
    // device needs the machine's LAN address passed via --dart-define.
    defaultValue: 'http://127.0.0.1:8000/api',
  );

  static const String _tokenKey = 'd2k.auth.token';
  static const Duration _timeout = Duration(seconds: 20);

  final String baseUrl;
  final http.Client _client;

  String? _token;

  String? get token => _token;
  bool get isAuthenticated => _token != null;

  /// Restore a saved session at start-up.
  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
  }

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token == null) {
      await prefs.remove(_tokenKey);
    } else {
      await prefs.setString(_tokenKey, token);
    }
  }

  Map<String, String> get _headers => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) {
    final uri = Uri.parse('$baseUrl$path').replace(
      queryParameters: query?.map(
        (key, value) => MapEntry(key, '$value'),
      ),
    );

    return _send(() => _client.get(uri, headers: _headers));
  }

  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) {
    return _send(() => _client.post(
          Uri.parse('$baseUrl$path'),
          headers: _headers,
          body: body == null ? null : jsonEncode(body),
        ));
  }

  Future<Map<String, dynamic>> put(String path, [Map<String, dynamic>? body]) {
    return _send(() => _client.put(
          Uri.parse('$baseUrl$path'),
          headers: _headers,
          body: body == null ? null : jsonEncode(body),
        ));
  }

  Future<Map<String, dynamic>> delete(String path) {
    return _send(() => _client.delete(Uri.parse('$baseUrl$path'), headers: _headers));
  }

  /// Runs a request and turns transport problems into the same [ApiException]
  /// the screens already handle, so "no signal" and "server said no" are not
  /// two different kinds of failure at the call site.
  Future<Map<String, dynamic>> _send(Future<http.Response> Function() request) async {
    try {
      final response = await request().timeout(_timeout);
      return _decode(response);
    } on ApiException {
      rethrow;
    } on TimeoutException {
      throw const ApiException(
        statusCode: ApiException.timeout,
        message: 'The server took too long to respond. Please try again.',
      );
    } on SocketException {
      throw const ApiException(
        statusCode: ApiException.offline,
        message: 'No internet connection. Check your network and try again.',
      );
    } on http.ClientException {
      throw const ApiException(
        statusCode: ApiException.offline,
        message: 'Could not reach Direct2Kariakoo. Check your connection.',
      );
    } on FormatException {
      throw const ApiException(
        statusCode: ApiException.badResponse,
        message: 'The server sent an unexpected response.',
      );
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    final decoded = response.body.isEmpty
        ? const <String, dynamic>{}
        : jsonDecode(response.body);

    final body = decoded is Map<String, dynamic>
        ? decoded
        // A few endpoints return a bare array; wrap it so callers see one shape.
        : <String, dynamic>{'data': decoded};

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    if (response.statusCode == 401) {
      // The credential is stale — drop it so the app reverts to guest mode
      // rather than looping on a token the server has rejected.
      unawaited(setToken(null));
    }

    throw ApiException(
      statusCode: response.statusCode,
      message: _messageFrom(body),
    );
  }

  String _messageFrom(Map<String, dynamic> body) {
    final message = body['message'];
    if (message is String && message.isNotEmpty) return message;

    final errors = body['errors'];
    if (errors is Map && errors.isNotEmpty) {
      final first = errors.values.first;
      if (first is List && first.isNotEmpty) return '${first.first}';
    }

    return 'Something went wrong. Please try again.';
  }
}

class ApiException implements Exception {
  const ApiException({required this.statusCode, required this.message});

  /// Local codes for transport failures, kept outside the HTTP range so a
  /// screen can tell "you are offline" from "the server refused".
  static const int offline = -1;
  static const int timeout = -2;
  static const int badResponse = -3;

  final int statusCode;
  final String message;

  bool get isUnauthenticated => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isValidation => statusCode == 422;
  bool get isRateLimited => statusCode == 429;
  bool get isServerFault => statusCode >= 500;

  /// True when retrying could plausibly succeed — the difference between a
  /// "Try again" button and a message explaining that nothing will change.
  bool get isRetryable =>
      statusCode == offline ||
      statusCode == timeout ||
      isRateLimited ||
      isServerFault;

  @override
  String toString() => message;
}
