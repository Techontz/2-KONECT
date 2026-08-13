import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../core/theme/app_colors.dart';

/// One image widget for the whole application.
///
/// Accepts both bundled asset paths (the sample catalogue) and remote URLs (a
/// future API) and always degrades to a branded placeholder instead of a broken
/// image box.
class AppImage extends StatelessWidget {
  const AppImage(
    this.path, {
    super.key,
    this.fit = BoxFit.contain,
    this.width,
    this.height,
    this.padding = EdgeInsets.zero,
    this.backgroundColor,
  });

  final String? path;
  final BoxFit fit;
  final double? width;
  final double? height;
  final EdgeInsets padding;
  final Color? backgroundColor;

  bool get _isRemote =>
      path != null && (path!.startsWith('http://') || path!.startsWith('https://'));

  /// D2K's banner artwork is authored as SVG. Flutter's raster decoder cannot
  /// read it — every SVG banner rendered as the "missing image" placeholder
  /// until this branch existed.
  bool get _isVector => (path ?? '').toLowerCase().split('?').first.endsWith('.svg');

  @override
  Widget build(BuildContext context) {
    final source = path;
    Widget child;

    if (source == null || source.isEmpty) {
      child = const _ImageFallback();
    } else if (_isVector) {
      child = _isRemote
          ? SvgPicture.network(
              source,
              fit: fit,
              placeholderBuilder: (_) => const _ImageSkeleton(),
            )
          : SvgPicture.asset(
              source,
              fit: fit,
              placeholderBuilder: (_) => const _ImageSkeleton(),
            );
    } else if (_isRemote) {
      child = CachedNetworkImage(
        imageUrl: source,
        fit: fit,
        fadeInDuration: const Duration(milliseconds: 180),
        placeholder: (_, __) => const _ImageSkeleton(),
        errorWidget: (_, __, ___) => const _ImageFallback(),
      );
    } else {
      child = Image.asset(
        source,
        fit: fit,
        errorBuilder: (_, __, ___) => const _ImageFallback(),
      );
    }

    return Container(
      width: width,
      height: height,
      color: backgroundColor,
      padding: padding,
      child: child,
    );
  }
}

class _ImageSkeleton extends StatelessWidget {
  const _ImageSkeleton();

  @override
  Widget build(BuildContext context) =>
      const ColoredBox(color: AppColors.tileSurface);
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.tileSurface,
      alignment: Alignment.center,
      child: const Icon(
        Icons.shopping_bag_outlined,
        color: AppColors.textTertiary,
        size: 26,
      ),
    );
  }
}
