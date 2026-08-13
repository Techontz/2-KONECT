import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';
import '../domain/models/catalog.dart';
import 'app_image.dart';
import 'badges.dart';

/// The two-row, horizontally paged tile grid directly under the hero banner.
class HomeTileGrid extends StatelessWidget {
  const HomeTileGrid({
    super.key,
    required this.tiles,
    required this.onTap,
  });

  final List<Map<String, Object?>> tiles;
  final void Function(String label) onTap;

  @override
  Widget build(BuildContext context) {
    const rows = 2;
    final columns = (tiles.length / rows).ceil();
    const tileWidth = AppSizes.homeTileSize;
    const gap = 10.0;

    return SizedBox(
      height: (AppSizes.homeTileSize + 42) * rows + gap,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
        child: SizedBox(
          width: columns * tileWidth + (columns - 1) * gap,
          child: Column(
            children: [
              for (var row = 0; row < rows; row++) ...[
                if (row > 0) const SizedBox(height: gap),
                Row(
                  children: [
                    for (var col = 0; col < columns; col++) ...[
                      if (col > 0) const SizedBox(width: gap),
                      SizedBox(
                        width: tileWidth,
                        child: () {
                          final index = row * columns + col;
                          if (index >= tiles.length) {
                            return const SizedBox.shrink();
                          }
                          final tile = tiles[index];
                          return _HomeTile(
                            label: tile['label'] as String,
                            image: tile['image'] as String?,
                            badge: tile['badge'] as String?,
                            onTap: () => onTap(tile['label'] as String),
                          );
                        }(),
                      ),
                    ],
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeTile extends StatelessWidget {
  const _HomeTile({
    required this.label,
    required this.image,
    required this.badge,
    required this.onTap,
  });

  final String label;
  final String? image;
  final String? badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: AppSizes.homeTileSize,
            height: AppSizes.homeTileSize,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                ClipRRect(
                  borderRadius: AppRadius.tile,
                  child: AppImage(
                    image,
                    fit: BoxFit.contain,
                    width: AppSizes.homeTileSize,
                    height: AppSizes.homeTileSize,
                    backgroundColor: AppColors.surface,
                    padding: const EdgeInsets.all(8),
                  ),
                ),
                if (badge != null)
                  Positioned(
                    left: 4,
                    right: 4,
                    bottom: -7,
                    child: Center(child: PromoCapsule(label: badge!)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 30,
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.tileLabel,
            ),
          ),
        ],
      ),
    );
  }
}

/// Horizontal shelf of image tiles with a caption — used for subcategory rows
/// ("Women's fashion → Tops / Dresses / Sportswear") and editorial shelves.
class ImageTileShelf extends StatelessWidget {
  const ImageTileShelf({
    super.key,
    required this.items,
    required this.onTap,
    this.tileSize = 130,
    this.tileColor = AppColors.tileSurface,
  });

  final List<Subcategory> items;
  final ValueChanged<Subcategory> onTap;
  final double tileSize;
  final Color tileColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: tileSize + 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final item = items[index];
          return GestureDetector(
            onTap: () => onTap(item),
            child: SizedBox(
              width: tileSize,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: AppRadius.tile,
                    child: AppImage(
                      item.image,
                      width: tileSize,
                      height: tileSize,
                      fit: BoxFit.contain,
                      backgroundColor: tileColor,
                      padding: const EdgeInsets.all(8),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.tileLabel,
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

/// 4 x 2 rounded brand plates.
class BrandGrid extends StatelessWidget {
  const BrandGrid({super.key, required this.brands, required this.onTap});

  final List<Brand> brands;
  final ValueChanged<Brand> onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        itemCount: brands.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.55,
        ),
        itemBuilder: (context, index) {
          final brand = brands[index];
          return GestureDetector(
            onTap: () => onTap(brand),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.tileSurface,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                brand.name,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.tileLabel.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
