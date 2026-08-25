import 'dart:async';

import 'package:dio/dio.dart';

import '../config/env.dart';
import '../storage/token_store.dart';
import 'api_exception.dart';

/// The one HTTP client the whole app uses.
///
/// Mirrors `2k-web/lib/api.ts`: a bearer token when there is one, and a 401
/// that clears the credential without bouncing anybody to a login screen —
/// the storefront is browsable signed out, so an unauthorised wishlist read is
/// a normal outcome rather than an error worth interrupting for.
class ApiClient {
  ApiClient({required TokenStore tokens, Dio? dio})
      : _tokens = tokens,
        _dio = dio ?? Dio() {
    _dio.options = _dio.options.copyWith(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: Env.connectTimeout,
      receiveTimeout: Env.receiveTimeout,
      headers: {'Accept': 'application/json'},
      // Every non-2xx is raised so one place turns it into an ApiException.
      validateStatus: (status) => status != null && status >= 200 && status < 300,
    );

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _tokens.cachedToken;
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // The credential is stale — drop it so the UI renders as a guest.
          await _tokens.clear();
          _onUnauthenticated?.call();
        }
        handler.next(error);
      },
    ));
  }

  final Dio _dio;
  final TokenStore _tokens;
  void Function()? _onUnauthenticated;

  /// Called when the server rejects the stored token, so the session provider
  /// can drop the signed-in user without every call site checking for it.
  set onUnauthenticated(void Function() callback) => _onUnauthenticated = callback;

  Dio get raw => _dio;

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) =>
      _send(() => _dio.get<T>(path, queryParameters: _clean(query), cancelToken: cancelToken));

  Future<T> post<T>(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) =>
      _send(() => _dio.post<T>(path, data: body, queryParameters: _clean(query), cancelToken: cancelToken));

  Future<T> put<T>(String path, {Object? body}) => _send(() => _dio.put<T>(path, data: body));

  Future<T> delete<T>(String path, {Object? body}) =>
      _send(() => _dio.delete<T>(path, data: body));

  Future<T> _send<T>(Future<Response<T>> Function() call) async {
    try {
      final response = await call();
      return response.data as T;
    } on DioException catch (error) {
      throw ApiException.from(error);
    }
  }

  /// Drops nulls and empty strings, and renders booleans the way Laravel's
  /// `boolean` rule accepts them — 1/0, never "true"/"false".
  static Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final out = <String, dynamic>{};
    query.forEach((key, value) {
      if (value == null) return;
      if (value is String && value.isEmpty) return;
      out[key] = value is bool ? (value ? 1 : 0) : value;
    });
    return out.isEmpty ? null : out;
  }
}
