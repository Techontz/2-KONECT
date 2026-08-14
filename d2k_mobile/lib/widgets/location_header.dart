import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';
import '../data/promo_data.dart';
import '../state/app_controllers.dart';

/// "📍 Other ⌄ / Kariakoo Market - Dar es Salaam - Tanzania"
class LocationHeader extends StatelessWidget {
  const LocationHeader({super.key, this.padding, this.compact = false});

  final EdgeInsets? padding;

  /// Set when the row shares the header band with the wordmark: it drops the
  /// "Deliver to" label and right-aligns, so a long Swahili place name still
  /// fits beside the brand on a 320pt screen.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final location = context.watch<LocationController>().location;
    return Padding(
      padding: padding ??
          const EdgeInsets.fromLTRB(AppSpacing.gutter, 6, AppSpacing.gutter, 10),
      child: GestureDetector(
        onTap: () => showLocationSheet(context),
        behavior: HitTestBehavior.opaque,
        child: compact
            // Beside the wordmark: one line, right-aligned, and allowed to
            // ellipsise rather than push the brand off the screen.
            ? Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  const Icon(Icons.location_on_outlined,
                      size: 15, color: AppColors.brandBlack),
                  const SizedBox(width: 3),
                  Flexible(
                    child: Text(
                      location.summary,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.end,
                      style: AppTypography.meta.copyWith(
                        color: AppColors.brandBlack,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const Icon(Icons.keyboard_arrow_down,
                      size: 17, color: AppColors.brandBlack),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.location_on, size: 19),
                      const SizedBox(width: 5),
                      Text(
                        location.label,
                        style: AppTypography.sectionTitle.copyWith(fontSize: 17),
                      ),
                      const Icon(Icons.keyboard_arrow_down, size: 21),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    location.summary,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.body.copyWith(fontSize: 14.5),
                  ),
                ],
              ),
      ),
    );
  }
}

/// Bottom sheet for changing the delivery area without leaving the feed.
Future<void> showLocationSheet(BuildContext context) {
  final controller = context.read<LocationController>();
  final areas = controller.country.isPrimary
      ? PromoData.tanzaniaAreas
      : [
          for (final city in controller.country.cities)
            {'area': 'City Centre', 'city': city}
        ];

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) => SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 14),
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.divider,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter, 16, AppSpacing.gutter, 8),
            child: Text('Deliver to', style: AppTypography.sectionTitle),
          ),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.gutter, vertical: 4),
              itemCount: areas.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final area = areas[index];
                final selected = controller.location.area == area['area'];
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    selected ? Icons.location_on : Icons.location_on_outlined,
                    color:
                        selected ? AppColors.primary : AppColors.textSecondary,
                  ),
                  title: Text(area['area']!, style: AppTypography.bodyStrong),
                  subtitle:
                      Text(area['city']!, style: AppTypography.metaMuted),
                  trailing: selected
                      ? const Icon(Icons.check_circle,
                          color: AppColors.primary, size: 20)
                      : null,
                  onTap: () {
                    controller.setLocation(
                        area: area['area']!, city: area['city']!);
                    Navigator.of(sheetContext).pop();
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}
