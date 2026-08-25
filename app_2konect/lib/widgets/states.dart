import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_exception.dart';
import '../core/theme/tokens.dart';
import '../providers/language.dart';

/// The four states every network-backed surface has to be able to show.
///
/// Centralised so no screen ever ships with a bare `CircularProgressIndicator`
/// where an empty state belongs, or a raw exception where a sentence belongs.

/// A shimmering placeholder block.
///
/// A sweep rather than a pulse, matching the website's `.skeleton`: a gradient
/// travelling left-to-right reads as "this is arriving", where a fading block
/// reads as "this is broken". One controller drives every block on screen
/// through an InheritedWidget, so a grid of twenty shimmers in step instead of
/// twenty independent animations beating against each other.
class Skeleton extends StatelessWidget {
  const Skeleton({
    super.key,
    this.width,
    this.height = 14,
    this.radius = K.rXs,
    this.margin = EdgeInsets.zero,
  });

  final double? width;
  final double height;
  final double radius;
  final EdgeInsets margin;

  /// The three stops the website's gradient uses.
  static const _base = Color(0xFFE7EBEF);
  static const _highlight = Color(0xFFF3F5F8);

  @override
  Widget build(BuildContext context) {
    final t = _ShimmerClock.of(context);

    return Container(
      width: width,
      height: height,
      margin: margin,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(borderRadius: K.radius(radius)),
      child: t == null
          ? const ColoredBox(color: _base)
          : AnimatedBuilder(
              animation: t,
              builder: (context, _) => DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    // Travels a little past both edges so the sweep enters and
                    // leaves rather than appearing in the middle.
                    begin: Alignment(-2.0 + t.value * 4, 0),
                    end: Alignment(-1.0 + t.value * 4, 0),
                    colors: const [_base, _highlight, _base],
                    stops: const [0.0, 0.5, 1.0],
                  ),
                ),
              ),
            ),
    );
  }
}

/// Drives every [Skeleton] beneath it from one ticker.
///
/// Mounted once by [SkeletonScope]; a Skeleton with no scope above it falls
/// back to a flat tint rather than throwing, so a placeholder can be dropped
/// anywhere without ceremony.
class _ShimmerClock extends InheritedWidget {
  const _ShimmerClock({required this.controller, required super.child});

  final AnimationController controller;

  static Animation<double>? of(BuildContext context) => context
      .dependOnInheritedWidgetOfExactType<_ShimmerClock>()
      ?.controller;

  @override
  bool updateShouldNotify(_ShimmerClock oldWidget) =>
      oldWidget.controller != controller;
}

/// Wraps a loading layout so its skeletons shimmer together.
class SkeletonScope extends StatefulWidget {
  const SkeletonScope({super.key, required this.child});

  final Widget child;

  @override
  State<SkeletonScope> createState() => _SkeletonScopeState();
}

class _SkeletonScopeState extends State<SkeletonScope>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _ShimmerClock(controller: _controller, child: widget.child);
}

/// The skeleton of a product tile.
///
/// Its geometry matches the real card block for block — square plate, the
/// availability band with its hairlines, two title lines, a price and a
/// metadata line — so a loading grid has the shape of the grid that replaces
/// it and nothing jumps when it arrives.
class ProductCardSkeleton extends StatelessWidget {
  const ProductCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: K.surface,
        borderRadius: K.radius(K.rMd),
        border: K.hairline,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AspectRatio(aspectRatio: 1, child: Skeleton(radius: 0, height: double.infinity)),
          // The availability band: same 27px and same hairlines as the real one.
          Container(
            height: 27,
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(color: K.line),
                bottom: BorderSide(color: K.line),
              ),
            ),
            child: const Skeleton(radius: 0, height: double.infinity),
          ),
          const Padding(
            padding: EdgeInsets.all(K.s10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Skeleton(height: 11),
                SizedBox(height: K.s6),
                Skeleton(width: 110, height: 11),
                SizedBox(height: K.s12),
                Skeleton(width: 96, height: 16),
                SizedBox(height: K.s8),
                Skeleton(width: 70, height: 9),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Nothing here — and, wherever possible, something to do about it.
///
/// The website's shape: an 80px tinted disc holding a single line-weight glyph,
/// a heavy title, one calm sentence, and at most two actions. No illustration:
/// a large drawing in an empty cart is decoration standing where a way forward
/// should be.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
    this.secondaryLabel,
    this.onSecondary,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: EdgeInsets.symmetric(
          horizontal: K.s28,
          vertical: compact ? K.s28 : 56,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(color: K.brand50, shape: BoxShape.circle),
              child: Icon(icon, size: 32, color: K.brand400),
            ),
            const SizedBox(height: K.s20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (message != null && message!.isNotEmpty) ...[
              const SizedBox(height: K.s8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 340),
                child: Text(
                  message!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ],
            if (onAction != null && actionLabel != null) ...[
              const SizedBox(height: K.s24),
              FilledButton(
                onPressed: onAction,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: K.s16),
                  child: Text(actionLabel!),
                ),
              ),
            ],
            if (onSecondary != null && secondaryLabel != null) ...[
              const SizedBox(height: K.s8),
              TextButton(onPressed: onSecondary, child: Text(secondaryLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

/// A failure, in a sentence the customer can act on, with a way to try again.
///
/// Never renders a raw exception: `ApiException` has already turned the
/// server's answer into something safe to read.
class ErrorState extends ConsumerWidget {
  const ErrorState({super.key, required this.error, this.onRetry, this.compact = false});

  final Object error;
  final VoidCallback? onRetry;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final failure = error is ApiException ? error as ApiException : ApiException.from(error);

    final icon = switch (failure.failure) {
      ApiFailure.offline || ApiFailure.timeout => Icons.wifi_off_rounded,
      ApiFailure.notFound => Icons.search_off_rounded,
      ApiFailure.forbidden || ApiFailure.unauthenticated => Icons.lock_outline_rounded,
      _ => Icons.error_outline_rounded,
    };

    return EmptyState(
      icon: icon,
      title: failure.isOffline ? ref.t('common.offline') : ref.t('common.somethingWrong'),
      message: failure.isOffline ? null : failure.message,
      actionLabel: onRetry == null ? null : ref.t('common.retry'),
      onAction: onRetry,
      compact: compact,
    );
  }
}

/// The bar that appears when the handset loses its connection.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      width: double.infinity,
      color: K.warnSoft,
      padding: const EdgeInsets.symmetric(horizontal: K.gutter, vertical: K.s10),
      child: Row(
        children: [
          const Icon(Icons.wifi_off_rounded, size: 15, color: K.warn),
          const SizedBox(width: K.s8),
          Expanded(
            child: Text(
              ref.t('common.offline'),
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: K.warn),
            ),
          ),
        ],
      ),
    );
  }
}

/// A centred spinner, for the few places a skeleton would be dishonest — a
/// button mid-submit, a sheet that has no shape yet.
class Loading extends StatelessWidget {
  const Loading({super.key, this.size = 22, this.padding = const EdgeInsets.all(K.s28)});

  final double size;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: padding,
          child: SizedBox(
            width: size,
            height: size,
            child: const CircularProgressIndicator(strokeWidth: 2.2),
          ),
        ),
      );
}
