import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../data/remote_catalog_source.dart';
import '../domain/models/catalog.dart';
import 'app_image.dart';

/// The circular category strip under the hero.
///
/// Categories, their names and their artwork all come from the backend, so an
/// admin adding a category makes it appear here without an app release.
class HomeCategoryRail extends StatelessWidget {
  const HomeCategoryRail({
    super.key,
    required this.categories,
    required this.onTap,
  });

  final List<Category> categories;
  final ValueChanged<Category> onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 104,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          final category = categories[index];
          return GestureDetector(
            onTap: () => onTap(category),
            behavior: HitTestBehavior.opaque,
            child: SizedBox(
              width: 68,
              child: Column(
                children: [
                  ClipOval(
                    child: AppImage(
                      category.image,
                      width: 60,
                      height: 60,
                      fit: BoxFit.cover,
                      backgroundColor: AppColors.surface,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    category.name,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      height: 1.25,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// A promotional card in the "Offers for you" rail.
///
/// The artwork is whatever the admin uploaded; the phone crop is preferred
/// when one exists so a wide desktop banner is not squeezed onto a handset.
class PromoCardView extends StatelessWidget {
  const PromoCardView({super.key, required this.banner, this.onTap});

  final RemoteBanner banner;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 250,
        child: ClipRRect(
          borderRadius: AppRadius.card,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (banner.hasImage)
                AppImage(
                  banner.bestImage,
                  fit: BoxFit.cover,
                  backgroundColor: AppColors.tileSurface,
                )
              else
                const ColoredBox(color: AppColors.brandBlack),

              // A scrim only where the words sit, so the artwork stays legible.
              // Same reasoning as the hero: artwork speaks for itself.
              if (!banner.hasImage && (banner.title.isNotEmpty || banner.subtitle != null))
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(14, 22, 14, 12),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0x00000000), Color(0xCC000000)],
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (banner.title.isNotEmpty)
                          Text(
                            banner.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                            ),
                          ),
                        if (banner.subtitle != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              banner.subtitle!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 11.5,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
