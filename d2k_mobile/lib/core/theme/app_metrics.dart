import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Spacing scale.
class AppSpacing {
  const AppSpacing._();

  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;

  /// Horizontal page gutter used across every screen in the reference.
  static const double gutter = 16;

  /// Vertical rhythm between two feed sections.
  static const double sectionGap = 22;
}

/// Corner radii.
class AppRadius {
  const AppRadius._();

  static const double xs = 6;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double pill = 999;

  static const BorderRadius card = BorderRadius.all(Radius.circular(md));
  static const BorderRadius tile = BorderRadius.all(Radius.circular(14));
  static const BorderRadius banner = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius sheet =
      BorderRadius.vertical(top: Radius.circular(xl));
}

/// Elevation tokens — the reference uses very soft, wide shadows.
class AppShadows {
  const AppShadows._();

  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color(0x0F111827),
      blurRadius: 10,
      offset: Offset(0, 2),
    ),
  ];

  static const List<BoxShadow> raised = [
    BoxShadow(
      color: Color(0x1A111827),
      blurRadius: 14,
      offset: Offset(0, 4),
    ),
  ];

  static const List<BoxShadow> floating = [
    BoxShadow(
      color: Color(0x26111827),
      blurRadius: 18,
      offset: Offset(0, 6),
    ),
  ];

  static const List<BoxShadow> navBar = [
    BoxShadow(
      color: Color(0x14111827),
      blurRadius: 12,
      offset: Offset(0, -2),
    ),
  ];
}

/// Fixed component dimensions measured from the reference recording.
class AppSizes {
  const AppSizes._();

  static const double searchBarHeight = 48;
  static const double stripBannerHeight = 42;
  static const double heroBannerRatio = 2.22; // width / height
  static const double navBarHeight = 58;
  static const double productCardWidth = 152;
  static const double productImageRatio = 1.02; // width / height
  static const double homeTileSize = 96;
  static const double addButton = 34;

  /// Height of the product card's text block below the image plate: title,
  /// rating, price, meta line and delivery pill, all of which are fixed.
  static const double productCardDetailsHeight = 172;

  /// Height of a product-card shelf (fixed-width card image + details block).
  static const double productShelfHeight =
      productCardWidth / productImageRatio + productCardDetailsHeight;

  /// Cell height for a product grid.
  ///
  /// The image plate keeps [productImageRatio] as the cell widens, so the
  /// extent has to be derived from the real cell width — a constant tuned on
  /// one handset overflows on a wider screen.
  static double productGridExtentFor(
    BuildContext context, {
    int columns = 2,
    double spacing = AppSpacing.md,
    double gutter = AppSpacing.gutter,
  }) {
    final width = MediaQuery.sizeOf(context).width;
    final cell =
        (width - gutter * 2 - spacing * (columns - 1)) / columns;
    return cell / productImageRatio + productCardDetailsHeight;
  }
  static const double favouriteButton = 30;
}

/// Shared decorations.
class AppDecorations {
  const AppDecorations._();

  static BoxDecoration get card => const BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.card,
        boxShadow: AppShadows.card,
      );

  static BoxDecoration get flatCard => const BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.card,
      );
}
