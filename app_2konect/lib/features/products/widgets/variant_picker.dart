import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../models/product.dart';
import '../../../widgets/primitives.dart';

/// Choosing a combination — colour, size, and whatever else the seller defined.
///
/// A value that no live combination contains is shown struck through rather
/// than hidden, so the shopper can see it exists and simply is not available
/// with what they have already picked.
class VariantPicker extends ConsumerWidget {
  const VariantPicker({
    super.key,
    required this.axes,
    required this.variants,
    required this.selection,
    required this.onSelect,
  });

  final List<OptionAxis> axes;
  final List<ProductVariant> variants;
  final Map<int, int> selection;
  final void Function(int attributeId, int valueId) onSelect;

  /// Whether picking [valueId] on [axis] still leaves a buyable combination,
  /// given everything else already chosen.
  bool _reachable(OptionAxis axis, int valueId) {
    final trial = {...selection, axis.attributeId: valueId};
    return variants.any((variant) => variant.inStock && variant.matches(trial));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final axis in axes) ...[
            Text(
              axis.unit == null ? axis.name : '${axis.name} (${axis.unit})',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: K.ink),
            ),
            const SizedBox(height: K.s10),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: [
                for (final value in axis.values)
                  _Value(
                    label: value.value,
                    selected: selection[axis.attributeId] == value.id,
                    available: _reachable(axis, value.id),
                    onTap: () => onSelect(axis.attributeId, value.id),
                  ),
              ],
            ),
            if (axis != axes.last) const SizedBox(height: K.gutter),
          ],
        ],
      ),
    );
  }
}

class _Value extends StatelessWidget {
  const _Value({
    required this.label,
    required this.selected,
    required this.available,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool available;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? K.brand : K.surface,
      borderRadius: K.radius(K.rSm),
      child: InkWell(
        // Still selectable: choosing it re-opens the other axes rather than
        // trapping the shopper in a dead combination.
        onTap: onTap,
        borderRadius: K.radius(K.rSm),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: K.radius(K.rSm),
            border: Border.all(color: selected ? K.brand : K.lineStrong),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: selected
                  ? Colors.white
                  : available
                      ? K.inkSoft
                      : K.inkFaint,
              decoration: available ? null : TextDecoration.lineThrough,
              decorationColor: K.inkFaint,
            ),
          ),
        ),
      ),
    );
  }
}
