import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../state/app_controllers.dart';

/// The heart control from the reference product card: outlined by default,
/// filled red with a short pop animation once saved.
class FavouriteButton extends StatefulWidget {
  const FavouriteButton({
    super.key,
    required this.productId,
    this.size = AppSizes.favouriteButton,
    this.iconSize = 19,
    this.filledBackground = false,
  });

  final String productId;
  final double size;
  final double iconSize;
  final bool filledBackground;

  @override
  State<FavouriteButton> createState() => _FavouriteButtonState();
}

class _FavouriteButtonState extends State<FavouriteButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  );

  late final Animation<double> _scale = TweenSequence<double>([
    TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.35), weight: 45),
    TweenSequenceItem(tween: Tween(begin: 1.35, end: 1.0), weight: 55),
  ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle() {
    final saved = context.read<WishlistController>().toggle(widget.productId);
    if (saved) _controller.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final saved = context.select<WishlistController, bool>(
        (w) => w.contains(widget.productId));

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Material(
        color: widget.filledBackground ? AppColors.surface : Colors.transparent,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: _toggle,
          child: Center(
            child: ScaleTransition(
              scale: _scale,
              child: Icon(
                saved ? Icons.favorite : Icons.favorite_border,
                size: widget.iconSize,
                color: saved ? AppColors.error : AppColors.textPrimary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
