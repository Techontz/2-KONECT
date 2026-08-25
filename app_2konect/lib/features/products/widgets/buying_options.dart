import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/theme/tokens.dart';
import '../../../models/product.dart';
import '../../../providers/language.dart';
import '../../../widgets/primitives.dart';

/// The same product, two ways to buy it.
///
/// This is 2KONECT's whole proposition made concrete on one screen: the stock
/// that is already in Tanzania, and the cheaper one we would import. Choosing
/// the import is what makes the order prepaid, so the difference is stated
/// here plainly rather than discovered at checkout.
class BuyingOptions extends ConsumerWidget {
  const BuyingOptions({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  final List<BuyingOption> options;
  final BuyingOption? selected;
  final ValueChanged<BuyingOption> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(ref.t('product.availabilityAndDelivery'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: K.s4),
          Text(
            ref.t('product.chooseYourOptions'),
            style: const TextStyle(fontSize: 12, height: 1.4, color: K.inkMuted),
          ),
          const SizedBox(height: K.s12),
          for (final option in options)
            _OptionRow(
              option: option,
              selected: identical(option, selected) || option.id == selected?.id,
              onTap: () => onSelect(option),
            ),
        ],
      ),
    );
  }
}

class _OptionRow extends ConsumerWidget {
  const _OptionRow({required this.option, required this.selected, required this.onTap});

  final BuyingOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sourcing = option.sourcing;
    final accent = sourcing.isLocal ? K.local : K.import;
    final tint = sourcing.isLocal ? K.localSoft : K.importSoft;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected ? tint : K.surface,
        borderRadius: K.radius(K.rSm),
        child: InkWell(
          onTap: onTap,
          borderRadius: K.radius(K.rSm),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: K.radius(K.rSm),
              border: Border.all(
                color: selected ? accent : K.line,
                width: selected ? 1.5 : 1,
              ),
            ),
            padding: const EdgeInsets.fromLTRB(12, 11, 12, 11),
            child: Row(
              children: [
                Icon(
                  selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                  size: 19,
                  color: selected ? accent : K.lineStrong,
                ),
                const SizedBox(width: K.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Icon(
                            sourcing.isLocal
                                ? Icons.location_on_rounded
                                : Icons.flight_takeoff_rounded,
                            size: 13,
                            color: accent,
                          ),
                          const SizedBox(width: K.s4),
                          Flexible(
                            child: Text(
                              sourcing.headline,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w800,
                                color: accent,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: K.s4),
                      Text(
                        '${option.seller} · ${sourcing.leadTime.label}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11.5, color: K.inkMuted),
                      ),
                      if (sourcing.isImport) ...[
                        const SizedBox(height: K.s6),
                        // Said here, on the screen where the choice is made,
                        // not sprung on the customer at checkout.
                        Text(
                          ref.t('payment.statusAwaitingPayment'),
                          style: const TextStyle(
                            fontSize: 10.5,
                            height: 1.35,
                            fontWeight: FontWeight.w600,
                            color: K.import,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: K.s10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      Money.format(option.price.current, option.price.currency),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                    ),
                    if (sourcing.isLocal && !option.inStock)
                      Text(
                        ref.t('product.soldOut'),
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: K.danger,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
