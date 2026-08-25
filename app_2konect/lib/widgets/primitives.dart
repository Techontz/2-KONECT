import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import '../models/common.dart';

/* ==========================================================================
   Small shared primitives.

   Each one exists because the storefront reuses the same visual element
   across cards, listings, the product page and checkout — defining them once
   is what keeps every surface consistent. Variants are props, never copies.

   This file is the Dart counterpart of `2k-web/components/ui/Primitives.tsx`
   and follows it deliberately closely: the same tones, the same sizes, the
   same two-line price, so the phone and the website are one product.
   ========================================================================== */

/// Which meaning a small label carries.
///
/// Local green and import blue are never used for anything else, so a badge
/// can never be mistaken for an action. Mirrors the website's `TONES` table.
enum Tone { neutral, brand, local, import, sale, success, warn, danger, dark }

extension ToneColours on Tone {
  /// The text colour, and the colour an icon beside it takes.
  Color get ink => switch (this) {
        Tone.neutral => K.inkMuted,
        Tone.brand => K.brand,
        Tone.local => K.local,
        Tone.import => K.import,
        // The website's sale tag is a solid red plate with white text rather
        // than a tinted one — a discount is meant to be seen from across a
        // grid, and it is the one badge allowed to shout.
        Tone.sale => Colors.white,
        Tone.success => K.success,
        Tone.warn => K.warn,
        Tone.danger => K.danger,
        Tone.dark => Colors.white,
      };

  Color get ground => switch (this) {
        Tone.neutral => K.surfaceAlt,
        Tone.brand => K.brand100,
        Tone.local => K.localSoft,
        Tone.import => K.importSoft,
        Tone.sale => K.sale,
        Tone.success => K.successSoft,
        Tone.warn => K.warnSoft,
        Tone.danger => K.dangerSoft,
        Tone.dark => K.ink,
      };

  /// Only the availability and brand tones carry a visible edge; the rest sit
  /// on their tint alone, which is what stops a card becoming a box of boxes.
  Color? get edge => switch (this) {
        Tone.local => K.localLine,
        Tone.import => K.importLine,
        Tone.brand => K.brand200,
        _ => null,
      };
}

/// A small, dense, uppercase label. The workhorse of the whole interface.
///
/// Uppercase and tracked out, exactly as on the website: at 10px a mixed-case
/// badge reads as a sentence fragment, and an uppercase one reads as a label —
/// which is what it is.
class Tag extends StatelessWidget {
  const Tag(this.label, {super.key, this.tone = Tone.neutral, this.icon});

  final String label;
  final Tone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final edge = tone.edge;

    return Container(
      padding: EdgeInsets.fromLTRB(icon == null ? K.s6 : 5, 3, K.s6, 3),
      decoration: BoxDecoration(
        color: tone.ground,
        borderRadius: K.radius(K.rXs),
        border: edge == null ? null : Border.all(color: edge),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: tone.ink),
            const SizedBox(width: 3),
          ],
          Flexible(
            child: Text(
              label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: KType.tag.copyWith(color: tone.ink),
            ),
          ),
        ],
      ),
    );
  }
}

/// −19% — the saving, as a tinted chip beside the struck price.
class DiscountChip extends StatelessWidget {
  const DiscountChip(this.percent, {super.key, this.solid = false});

  final int percent;

  /// Solid inverts it, for use over a photograph where a tint would vanish.
  final bool solid;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
      decoration: BoxDecoration(
        color: solid ? K.sale : K.saleSoft,
        borderRadius: K.radius(K.rXs),
      ),
      child: Text(
        // A true minus sign, not a hyphen: at 10px bold the hyphen reads as a
        // stray mark against the digits.
        '−$percent%',
        style: KType.tag.copyWith(
          color: solid ? Colors.white : K.sale,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

/// Price, its struck original and the saving — in one block, so the three can
/// never drift apart across screens.
///
/// Two lines, as on the website: the current price alone on the first, and the
/// struck original beside the discount chip on the second. Shilling amounts run
/// long, and squeezing all three onto one row truncates the figure that
/// matters. Nothing on the second line competes with the first.
class PriceBlock extends StatelessWidget {
  const PriceBlock({
    super.key,
    required this.price,
    this.size = 16,
    this.showWas = true,
    this.fromLabel,
  });

  final Price price;

  /// 13 on a dense row, 16 on a card, 22 on a product page, 30 in a hero.
  final double size;
  final bool showWas;

  /// "From" — set when the figure is the cheapest of several combinations
  /// rather than *the* price, so a grid never quotes one as though the choice
  /// did not change it.
  final String? fromLabel;

  @override
  Widget build(BuildContext context) {
    final discount = price.discountPercent ?? 0;
    final discounted = price.was != null && discount > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            if (fromLabel != null) ...[
              Text(
                fromLabel!.toUpperCase(),
                style: KType.tag.copyWith(color: K.inkFaint),
              ),
              const SizedBox(width: K.s4),
            ],
            Flexible(
              child: Text(
                Money.format(price.current, price.currency),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: KType.price(size),
              ),
            ),
          ],
        ),
        if (showWas && discounted) ...[
          const SizedBox(height: 3),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  // No currency label on the struck figure: it is the same
                  // currency, and repeating it only lengthens the line.
                  Money.amountOnly(price.was, price.currency),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KType.wasPrice,
                ),
              ),
              const SizedBox(width: K.s6),
              // The chip is fixed-content but not fixed-width: at a large text
              // size on a narrow card, "−11%" beside a six-figure struck price
              // is the pair that would otherwise break the row.
              Flexible(child: DiscountChip(discount)),
            ],
          ),
        ],
      ],
    );
  }
}

/// The star rating, as an amber chip with the count beside it.
///
/// The chip is what makes a 4.8 findable in a grid; the count outside it is
/// what makes the 4.8 mean something.
class RatingPill extends StatelessWidget {
  const RatingPill({super.key, required this.rating, this.showCount = false});

  final Rating rating;
  final bool showCount;

  @override
  Widget build(BuildContext context) {
    if (!rating.hasReviews) return const SizedBox.shrink();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // The chip is flexible from the outside as well as the inside. Its own
        // Flexible lets the number compress; this one lets the whole chip do
        // so, which is what a card 148px wide at 1.3× text actually needs.
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
            decoration: BoxDecoration(
              color: K.warnSoft,
              borderRadius: K.radius(K.rXs),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    rating.average.toStringAsFixed(1),
                    maxLines: 1,
                    overflow: TextOverflow.clip,
                    style: KType.tag.copyWith(color: K.warn, letterSpacing: 0),
                  ),
                ),
                const SizedBox(width: 2),
                const Icon(Icons.star_rounded, size: 10, color: K.warn),
              ],
            ),
          ),
        ),
        if (showCount) ...[
          const SizedBox(width: K.s4),
          // A four-figure review count on a narrow card at a large text size
          // is exactly the combination that used to push this row past the
          // card's edge. The chip is the part worth keeping; the count gives
          // way.
          Flexible(
            child: Text(
              '(${rating.count})',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: KType.meta,
            ),
          ),
        ],
      ],
    );
  }
}

/// The checkmark an administrator grants. Never self-declared.
class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({super.key, this.size = 13});

  final double size;

  @override
  Widget build(BuildContext context) =>
      Icon(Icons.verified_rounded, size: size, color: K.verified);
}

/// A section title with an optional action on the right.
///
/// One block for every section, so a long home screen has a pulse the eye
/// learns instead of re-measuring at each heading.
class SectionHead extends StatelessWidget {
  const SectionHead({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.padding = const EdgeInsets.fromLTRB(K.gutter, 0, K.s6, K.s12),
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        // Baselines, not centres: the action sits on the heading's own line
        // rather than floating against the subtitle.
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: K.s2),
                    child: Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
              ],
            ),
          ),
          if (onAction != null && actionLabel != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: K.s8),
                minimumSize: const Size(0, 40),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                textStyle: const TextStyle(
                  fontFamily: K.fontFamily,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(actionLabel!),
                  const Icon(Icons.chevron_right_rounded, size: 17),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Product photography, cached, with a quiet placeholder rather than a spinner.
///
/// A grid of twenty cards should fade in, not flicker with twenty progress
/// rings. Sizing hints are passed to the decoder so a 2,000px photograph is not
/// held in memory at full resolution behind a 160px tile.
class ProductImage extends StatelessWidget {
  const ProductImage({
    super.key,
    required this.url,
    this.fit = BoxFit.contain,
    this.padding = EdgeInsets.zero,
    this.decodeWidth,
  });

  final String? url;
  final BoxFit fit;
  final EdgeInsets padding;
  final int? decodeWidth;

  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) return const ImageFallback();

    final ratio = MediaQuery.maybeDevicePixelRatioOf(context) ?? 2.0;
    final width = decodeWidth == null ? null : (decodeWidth! * ratio).round();

    return Padding(
      padding: padding,
      child: CachedNetworkImage(
        imageUrl: url!,
        fit: fit,
        memCacheWidth: width,
        fadeInDuration: K.fast,
        // A still tint rather than a shimmer: twenty shimmering tiles in a
        // grid is a light show, and the card's own skeleton already animates.
        placeholder: (_, _) => const ColoredBox(color: K.surfaceAlt),
        errorWidget: (_, _, _) => const ImageFallback(),
      ),
    );
  }
}

/// What a missing or broken photograph looks like.
///
/// Deliberately quiet and the same height as a real one, so a product whose
/// image fails does not shorten its card or draw the eye to the failure.
class ImageFallback extends StatelessWidget {
  const ImageFallback({super.key});

  @override
  Widget build(BuildContext context) => const ColoredBox(
        color: K.surfaceAlt,
        child: Center(
          child: Icon(Icons.shopping_bag_outlined, size: 26, color: K.brand300),
        ),
      );
}

/// A hairline-bordered white panel — the surface almost everything sits on.
///
/// Border-first, as the website is: a commerce grid separated by hairlines
/// stays legible at any density; the same grid separated by shadows turns to
/// soup.
class Panel extends StatelessWidget {
  const Panel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(K.s14),
    this.margin = EdgeInsets.zero,
    this.radius = K.rMd,
    this.color = K.surface,
    this.border,
    this.onTap,
  });

  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets margin;
  final double radius;
  final Color color;
  final Border? border;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final decoration = BoxDecoration(
      color: color,
      borderRadius: K.radius(radius),
      border: border ?? K.hairline,
    );

    if (onTap == null) {
      return Container(
        margin: margin,
        decoration: decoration,
        child: Padding(padding: padding, child: child),
      );
    }

    return Padding(
      padding: margin,
      child: Material(
        color: color,
        borderRadius: K.radius(radius),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Ink(
            decoration: decoration,
            child: Padding(padding: padding, child: child),
          ),
        ),
      ),
    );
  }
}
