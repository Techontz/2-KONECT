import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/brand.dart';
import '../core/l10n/sourcing_copy.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import '../models/common.dart';
import '../providers/language.dart';
import 'primitives.dart';

/// The transit glyph, chosen from how the shipment actually travels.
IconData _transitIcon(Sourcing sourcing) {
  if (sourcing.isLocal) return Icons.storefront_rounded;
  return switch (sourcing.shippingMethod?.code) {
    'sea' => Icons.directions_boat_rounded,
    'road' => Icons.local_shipping_rounded,
    'air' => Icons.flight_rounded,
    _ => Icons.public_rounded,
  };
}

/// The strip across the top of a product card's details block.
///
/// Where it is and when it lands, on one tinted **full-width** row directly
/// under the photograph, bounded top and bottom by a hairline. It is
/// deliberately the loudest thing in the block after the price: in a grid of
/// twenty otherwise identical listings, this is the field that changes the
/// decision.
///
/// For an import it names the **origin country** — "China" — rather than
/// "Order from abroad". It is shorter, so it survives a 164px card without an
/// ellipsis, and it is strictly more information. The long form still leads
/// the product page, where there is room for it.
class AvailabilityStrip extends ConsumerWidget {
  const AvailabilityStrip({super.key, required this.sourcing});

  final Sourcing sourcing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tone = K.sourcingTone(sourcing.isLocal);
    final t = ref.strings;
    final flag = sourcing.isLocal
        ? (sourcing.destination?.flag ?? '🇹🇿')
        : (sourcing.origin?.flag ?? '🌍');
    // Rebuilt from the payload's structured fields, never the server's
    // pre-composed English — otherwise this band stays in English while the
    // screen around it turns Kiswahili.
    final where = sourcing.bandPlaceIn(t, Brand.country);
    final window = sourcing.leadTimeIn(t);

    // Measured against the real catalogue: "In Tanzania · 1–3 days" at 11px
    // bold needs ~139px, and a 164px shelf card offers 148px of inner width.
    // The spacing here is what buys that margin — a 10px gutter and 6px gaps
    // truncated it, so the band runs tighter than the blocks around it and
    // sheds the flag first when a narrower card leaves no room at all.
    return LayoutBuilder(
      builder: (context, constraints) {
        final showFlag = constraints.maxWidth.isFinite ? constraints.maxWidth >= 150 : true;

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: K.s8, vertical: 7),
          decoration: BoxDecoration(
            color: tone.soft,
            border: Border(
              top: BorderSide(color: tone.line),
              bottom: BorderSide(color: tone.line),
            ),
          ),
          child: Row(
            children: [
              // Every fixed element is given an explicit box. A flag is two
              // code points and renders at wildly different widths across
              // fonts and platforms; left to size itself it can eat the room
              // the words need. Bounding it is what makes the arithmetic below
              // hold everywhere rather than only in the font this was drawn in.
              if (showFlag) ...[
                SizedBox(
                  width: 13,
                  child: Text(
                    flag,
                    maxLines: 1,
                    overflow: TextOverflow.clip,
                    style: const TextStyle(fontSize: 11, height: 1),
                  ),
                ),
                const SizedBox(width: 3),
              ],
              // The place gives way first. "China · " on its own answers
              // nothing, so the window is the half that survives — the same
              // priority the website sets with `truncate` on the place and
              // `shrink-0` on the window.
              Flexible(
                child: Text(
                  where,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KType.strip.copyWith(color: tone.ink),
                ),
              ),
              const SizedBox(width: 3),
              SizedBox(
                width: 5,
                child: Text(
                  '·',
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  style: KType.strip.copyWith(color: tone.ink.withValues(alpha: 0.4)),
                ),
              ),
              const SizedBox(width: 3),
              // Laid out before the place, and capped rather than made
              // flexible: a non-flexible child takes its natural width, so the
              // window stays whole and the place absorbs whatever is left. The
              // cap makes overflow structurally impossible without letting a
              // flex ratio truncate a window that would have fitted — at real
              // metrics "7–14 days" needs ~55px against a ~90px ceiling.
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: constraints.maxWidth * 0.55),
                child: Text(
                  window,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: KType.strip.copyWith(color: tone.ink, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// The compact badge.
///
/// Used where the strip would be too heavy — a cart line, an order item, a
/// checkout summary row — and the surrounding row already carries its own
/// structure.
class AvailabilityBadge extends ConsumerWidget {
  const AvailabilityBadge({super.key, required this.sourcing, this.dense = false});

  final Sourcing sourcing;
  final bool dense;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tone = K.sourcingTone(sourcing.isLocal);

    return Container(
      padding: const EdgeInsets.fromLTRB(5, 3, K.s6, 3),
      decoration: BoxDecoration(
        color: tone.soft,
        borderRadius: K.radius(K.rXs),
        border: Border.all(color: tone.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_transitIcon(sourcing), size: dense ? 10 : 11, color: tone.ink),
          const SizedBox(width: K.s4),
          Flexible(
            child: Text(
              sourcing.labelIn(ref.strings, Brand.country),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: KType.tag.copyWith(
                color: tone.ink,
                fontSize: dense ? 9.5 : 10,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The long form, for a product page: headline, summary and the promised
/// window, on the tinted ground that belongs to its type.
class SourcingPanel extends ConsumerWidget {
  const SourcingPanel({super.key, required this.sourcing, required this.etaLabel});

  final Sourcing sourcing;

  /// Already-translated label for the delivery window row.
  final String etaLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isLocal = sourcing.isLocal;
    final colour = isLocal ? K.local : K.import;

    return Panel(
      color: isLocal ? K.localSoft : K.importSoft,
      border: Border.all(color: isLocal ? K.localLine : K.importLine),
      padding: const EdgeInsets.all(13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isLocal ? Icons.inventory_2_rounded : Icons.public_rounded,
            size: 20,
            color: colour,
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        sourcing.headlineIn(ref.strings, Brand.country),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: colour,
                        ),
                      ),
                    ),
                    if (sourcing.origin != null)
                      Text(sourcing.origin!.flag, style: const TextStyle(fontSize: 15)),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  sourcing.summaryIn(ref.strings),
                  style: const TextStyle(fontSize: 12.5, height: 1.4, color: K.inkSoft),
                ),
                if (sourcing.leadTimeIn(ref.strings).isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.schedule_rounded, size: 13, color: K.inkMuted),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          '$etaLabel: ${sourcing.leadTime.label}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: K.inkSoft,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                if (sourcing.shippingMethod != null) ...[
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      const Icon(Icons.local_shipping_outlined, size: 13, color: K.inkMuted),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          sourcing.shippingMethodIn(ref.strings) ?? '',
                          style: const TextStyle(fontSize: 12, color: K.inkMuted),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
