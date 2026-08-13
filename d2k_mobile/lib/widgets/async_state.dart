import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../data/api_client.dart';

/// The four states every network-backed screen can be in.
///
/// The rule this type exists to enforce: a failed request shows an error, never
/// a plausible-looking catalogue. Silently substituting placeholder content for
/// a failure is how an app looks healthy while being completely broken.
enum LoadStatus { idle, loading, ready, failed }

class Loadable<T> {
  const Loadable._(this.status, this.value, this.error);

  const Loadable.idle() : this._(LoadStatus.idle, null, null);
  const Loadable.loading() : this._(LoadStatus.loading, null, null);
  const Loadable.ready(T value) : this._(LoadStatus.ready, value, null);
  const Loadable.failed(Object error) : this._(LoadStatus.failed, null, error);

  final LoadStatus status;
  final T? value;
  final Object? error;

  bool get isLoading => status == LoadStatus.loading;
  bool get isReady => status == LoadStatus.ready;
  bool get hasFailed => status == LoadStatus.failed;

  String get message {
    final e = error;
    if (e is ApiException) return e.message;
    return 'Something went wrong. Please try again.';
  }

  bool get isRetryable {
    final e = error;
    return e is! ApiException || e.isRetryable;
  }
}

/// A centred spinner sized for a full screen area.
class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.label});

  final String? label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            height: 26,
            width: 26,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          ),
          if (label != null) ...[
            const SizedBox(height: 12),
            Text(
              label!,
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

/// Shown when the request succeeded but there is genuinely nothing to show.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.inbox_outlined,
    this.action,
  });

  final String title;
  final String? message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              height: 64,
              width: 64,
              decoration: BoxDecoration(
                color: AppColors.tileSurface,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 28, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            if (message != null) ...[
              const SizedBox(height: 6),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    );
  }
}

/// Shown when the request failed. Offers a retry only when retrying could
/// actually help — a 403 does not get a "Try again" button.
class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    required this.message,
    this.onRetry,
    this.canRetry = true,
  });

  final String message;
  final VoidCallback? onRetry;
  final bool canRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              height: 64,
              width: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFFDECEC),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.wifi_off_rounded,
                size: 28,
                color: Color(0xFFD3302F),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              "Couldn't load",
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: AppColors.textSecondary,
              ),
            ),
            if (canRetry && onRetry != null) ...[
              const SizedBox(height: 18),
              FilledButton(
                onPressed: onRetry,
                child: const Text('Try again'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Renders the right state for a [Loadable] without every screen repeating the
/// same switch.
class LoadableView<T> extends StatelessWidget {
  const LoadableView({
    super.key,
    required this.state,
    required this.builder,
    this.onRetry,
    this.loading,
    this.isEmpty,
    this.empty,
  });

  final Loadable<T> state;
  final Widget Function(BuildContext context, T value) builder;
  final VoidCallback? onRetry;
  final Widget? loading;

  /// Lets a screen say what "nothing to show" means for its own payload.
  final bool Function(T value)? isEmpty;
  final Widget? empty;

  @override
  Widget build(BuildContext context) {
    switch (state.status) {
      case LoadStatus.idle:
      case LoadStatus.loading:
        return loading ?? const LoadingState();
      case LoadStatus.failed:
        return ErrorState(
          message: state.message,
          onRetry: onRetry,
          canRetry: state.isRetryable,
        );
      case LoadStatus.ready:
        final value = state.value as T;
        if (isEmpty != null && isEmpty!(value) && empty != null) return empty!;
        return builder(context, value);
    }
  }
}
