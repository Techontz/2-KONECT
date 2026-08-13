import 'package:flutter/material.dart';

/// A top-level shopping category (Categories tab + home tiles).
class Category {
  const Category({
    required this.id,
    required this.name,
    required this.image,
    this.subcategories = const [],
    this.badge,
    this.badgeColor,
  });

  final String id;
  final String name;
  final String image;
  final List<Subcategory> subcategories;

  /// Optional promotional overlay used on the home tile grid
  /// ("FLAT 70% OFF", "FROM TZS 5,000").
  final String? badge;
  final Color? badgeColor;
}

class Subcategory {
  const Subcategory({
    required this.id,
    required this.name,
    required this.image,
  });

  final String id;
  final String name;
  final String image;
}

/// A hero banner in the home / deals carousels.
class PromoBanner {
  const PromoBanner({
    required this.id,
    required this.title,
    this.subtitle,
    this.eyebrow,
    this.ctaLabel,
    this.image,
    required this.gradient,
    this.foreground = Colors.white,
    this.savingBadge,
    this.targetCategoryId,
    this.targetQuery,
  });

  final String id;
  final String title;
  final String? subtitle;
  final String? eyebrow;
  final String? ctaLabel;
  final String? image;
  final List<Color> gradient;
  final Color foreground;
  final String? savingBadge;
  final String? targetCategoryId;
  final String? targetQuery;
}

/// The slim scrolling strip directly under the search bar.
class StripPromo {
  const StripPromo({
    required this.id,
    required this.headline,
    this.code,
    this.footnote,
    required this.gradient,
  });

  final String id;
  final String headline;
  final String? code;
  final String? footnote;
  final List<Color> gradient;
}

/// A card in the "Offers for you" carousel.
class OfferCard {
  const OfferCard({
    required this.id,
    required this.headline,
    this.subline,
    this.code,
    required this.canvas,
    this.icon,
  });

  final String id;
  final String headline;
  final String? subline;
  final String? code;
  final Color canvas;
  final IconData? icon;
}

/// A curated shelf: "Bestsellers", "Trending deals", "Summer essentials"…
class ProductShelf {
  const ProductShelf({
    required this.id,
    required this.title,
    required this.productIds,
    this.actionLabel,
    this.canvas,
  });

  final String id;
  final String title;
  final List<String> productIds;
  final String? actionLabel;
  final Color? canvas;
}

class Brand {
  const Brand({required this.id, required this.name, required this.logo});

  final String id;
  final String name;
  final String logo;
}
