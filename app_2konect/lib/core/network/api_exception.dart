import 'package:dio/dio.dart';

/// How a request failed, in terms the interface can act on.
enum ApiFailure {
  /// No usable connection, or the request never reached the origin.
  offline,
  timeout,
  /// 401 — the credential is missing or stale.
  unauthenticated,
  /// 403 — authenticated, but not allowed. A seller endpoint reached by a
  /// shopper is this, not a broken session.
  forbidden,
  notFound,
  /// 422 — validation, including a refused checkout rule.
  invalid,
  /// 429 — throttled.
  tooMany,
  server,
  unknown,
}

/// A Laravel error, normalised.
///
/// Raw framework exceptions never reach a screen: every call site is handed
/// one of these, with `message` already safe to render and `fieldErrors`
/// carrying Laravel's per-field validation bag when there is one.
class ApiException implements Exception {
  ApiException({
    required this.failure,
    required this.message,
    this.status,
    this.fieldErrors = const {},
  });

  final ApiFailure failure;
  final String message;
  final int? status;
  final Map<String, List<String>> fieldErrors;

  bool get isUnauthenticated => failure == ApiFailure.unauthenticated;
  bool get isForbidden => failure == ApiFailure.forbidden;
  bool get isOffline => failure == ApiFailure.offline || failure == ApiFailure.timeout;

  /// The first message Laravel gave for [field], if it complained about it.
  String? forField(String field) => fieldErrors[field]?.firstOrNull;

  static ApiException from(Object error) {
    if (error is ApiException) return error;
    if (error is! DioException) {
      return ApiException(failure: ApiFailure.unknown, message: _fallback);
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(
          failure: ApiFailure.timeout,
          message: 'This is taking longer than usual. Please try again.',
        );
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        return ApiException(
          failure: ApiFailure.offline,
          message: "We couldn't reach 2KONECT. Check your connection and try again.",
        );
      case DioExceptionType.cancel:
        return ApiException(failure: ApiFailure.unknown, message: _fallback);
      case DioExceptionType.badCertificate:
        return ApiException(
          failure: ApiFailure.offline,
          message: "We couldn't establish a secure connection.",
        );
      case DioExceptionType.badResponse:
        break;
      // Any future member of the enum is treated as an unknown transport
      // failure rather than crashing the request.
      default:
        return ApiException(failure: ApiFailure.unknown, message: _fallback);
    }

    final response = error.response;
    final status = response?.statusCode ?? 0;
    final body = response?.data;
    final data = body is Map ? body.cast<String, dynamic>() : const <String, dynamic>{};

    // Laravel's own sentence, when it wrote one. A checkout refusal — "Cash on
    // Delivery is not available for products ordered from abroad" — arrives
    // this way and is exactly what the customer should read.
    final serverMessage = data['message'];
    final fields = _fields(data['errors']);

    String message;
    ApiFailure failure;

    switch (status) {
      case 401:
        failure = ApiFailure.unauthenticated;
        message = 'Please sign in to continue.';
      case 403:
        failure = ApiFailure.forbidden;
        message = serverMessage is String && serverMessage.isNotEmpty
            ? serverMessage
            : "You don't have access to this.";
      case 404:
        failure = ApiFailure.notFound;
        message = serverMessage is String && serverMessage.isNotEmpty
            ? serverMessage
            : "We couldn't find that.";
      case 422:
        failure = ApiFailure.invalid;
        message = fields.values.firstOrNull?.firstOrNull ??
            (serverMessage is String && serverMessage.isNotEmpty
                ? serverMessage
                : 'Please check the details and try again.');
      case 429:
        failure = ApiFailure.tooMany;
        message = 'Too many attempts. Please wait a moment and try again.';
      default:
        failure = status >= 500 ? ApiFailure.server : ApiFailure.unknown;
        // Never surface a 500's body: it can carry a stack trace when the
        // server is in debug mode.
        message = failure == ApiFailure.server
            ? 'Something went wrong on our side. Please try again shortly.'
            : (serverMessage is String && serverMessage.isNotEmpty ? serverMessage : _fallback);
    }

    return ApiException(
      failure: failure,
      message: message,
      status: status,
      fieldErrors: fields,
    );
  }

  static Map<String, List<String>> _fields(Object? raw) {
    if (raw is! Map) return const {};
    final out = <String, List<String>>{};
    raw.forEach((key, value) {
      if (value is List) {
        out['$key'] = value.map((e) => '$e').toList();
      } else if (value != null) {
        out['$key'] = ['$value'];
      }
    });
    return out;
  }

  static const _fallback = 'Something went wrong. Please try again.';

  @override
  String toString() => 'ApiException($status, $failure): $message';
}

extension _FirstOrNull<E> on List<E> {
  E? get firstOrNull => isEmpty ? null : first;
}

extension _IterFirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
