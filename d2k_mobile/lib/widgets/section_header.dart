import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';

/// "Bestsellers                       View all ›" — the feed section header.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
    this.padding =
        const EdgeInsets.fromLTRB(AppSpacing.gutter, 0, AppSpacing.gutter, 12),
    this.titleStyle,
    this.actionStyle,
    this.darkAction = false,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EdgeInsets padding;
  final TextStyle? titleStyle;
  final TextStyle? actionStyle;

  /// Deals uses a dark filled "All deals ›" chip instead of a blue text link.
  final bool darkAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Text(
              title,
              style: titleStyle ?? AppTypography.sectionTitle,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (actionLabel != null) ...[
            const SizedBox(width: 12),
            if (darkAction)
              _DarkAction(label: actionLabel!, onTap: onAction)
            else
              InkWell(
                onTap: onAction,
                borderRadius: BorderRadius.circular(AppRadius.xs),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        actionLabel!,
                        style: actionStyle ?? AppTypography.sectionAction,
                      ),
                      const Icon(Icons.chevron_right,
                          size: 18, color: AppColors.primary),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _DarkAction extends StatelessWidget {
  const _DarkAction({required this.label, this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF3F3F46),
      borderRadius: BorderRadius.circular(AppRadius.sm),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label, style: AppTypography.badge.copyWith(fontSize: 13)),
              const Icon(Icons.chevron_right, size: 16, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}

/// Horizontally scrolling shelf with the standard gutter and card spacing.
class HorizontalShelf extends StatelessWidget {
  const HorizontalShelf({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.height = AppSizes.productShelfHeight,
    this.spacing = 10,
    this.padding =
        const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
  });

  final int itemCount;
  final NullableIndexedWidgetBuilder itemBuilder;
  final double? height;
  final double spacing;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final list = ListView.separated(
      scrollDirection: Axis.horizontal,
      padding: padding,
      physics: const BouncingScrollPhysics(),
      itemCount: itemCount,
      clipBehavior: Clip.none,
      separatorBuilder: (_, __) => SizedBox(width: spacing),
      itemBuilder: (context, index) =>
          itemBuilder(context, index) ?? const SizedBox.shrink(),
    );
    return height == null ? list : SizedBox(height: height, child: list);
  }
}
