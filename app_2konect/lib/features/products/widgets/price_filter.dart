import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/theme/tokens.dart';
import '../../../providers/language.dart';

/// Round caps below [max], coarsest last.
///
/// The ladder is derived from the catalogue, not written down here. A ladder
/// fixed in code puts "Under 5M" on a screen where the dearest thing costs
/// 90,000 — six chips that all mean "everything". This walks a 1 / 2.5 / 5
/// progression and keeps only the rungs that actually divide *this* result set.
List<double> priceLadder(double max, {int rungs = 6}) {
  if (!max.isFinite || max <= 0) return const [];

  final steps = <double>[];
  for (var exponent = 2; exponent <= 12; exponent++) {
    for (final mantissa in const [1.0, 2.5, 5.0]) {
      final value = mantissa * _pow10(exponent);
      // A cap at or above the dearest product selects everything, so it is not
      // a filter — it is the absence of one, and the ladder leaves it out.
      if (value < max) steps.add(value);
    }
  }

  return steps.length <= rungs ? steps : steps.sublist(steps.length - rungs);
}

double _pow10(int exponent) {
  var value = 1.0;
  for (var i = 0; i < exponent; i++) {
    value *= 10;
  }
  return value;
}

/// The maximum-price control.
///
/// Three ways into one number. A ladder of round caps for the common case, a
/// typed amount for the shopper who has an exact budget, and the slider for
/// sweeping through the range. They are three views of a single value, not
/// three filters: moving any one of them moves the other two.
///
/// The value carried out of here is always a plain number — 1500000, never
/// "TZS 1,500,000". The grouped digits exist only inside the text field.
class PriceFilter extends ConsumerStatefulWidget {
  const PriceFilter({
    super.key,
    required this.min,
    required this.max,
    required this.value,
    required this.onChanged,
  });

  /// Cheapest product in the current result set.
  final double min;

  /// Dearest product in the current result set.
  final double max;
  final double? value;
  final ValueChanged<double?> onChanged;

  @override
  ConsumerState<PriceFilter> createState() => _PriceFilterState();
}

class _PriceFilterState extends ConsumerState<PriceFilter> {
  late final TextEditingController _controller;
  late List<double> _ladder;

  /// Sticky: once the shopper opens the field it stays open, so the amount
  /// they typed does not vanish underneath them when it happens to coincide
  /// with a rung.
  late bool _custom;

  @override
  void initState() {
    super.initState();
    _ladder = priceLadder(widget.max);
    _custom = widget.value != null && !_ladder.contains(widget.value);
    _controller = TextEditingController(text: _grouped(widget.value));
  }

  @override
  void didUpdateWidget(PriceFilter old) {
    super.didUpdateWidget(old);
    if (old.max != widget.max) _ladder = priceLadder(widget.max);
    if (old.value != widget.value && !_hasFocus) {
      _controller.text = _grouped(widget.value);
    }
  }

  bool _hasFocus = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  static String _grouped(double? value) =>
      value == null ? '' : Money.amountOnly(value.round());

  /// A cap at or above the ceiling is no cap at all, and neither is zero.
  double? _normalise(double? amount) {
    if (amount == null || !amount.isFinite || amount <= 0) return null;
    return amount >= widget.max ? null : amount.roundToDouble();
  }

  void _apply(double? next, {bool fromField = false}) {
    final capped = _normalise(next);
    if (!fromField) _controller.text = _grouped(capped);
    widget.onChanged(capped);
  }

  @override
  Widget build(BuildContext context) {
    final ceiling = widget.max;
    final floor = widget.min < ceiling ? widget.min : 0.0;
    final current = widget.value ?? ceiling;
    final usable = ceiling > floor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                ref.t('filters.maxPrice'),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: K.ink),
              ),
            ),
            Text(
              widget.value == null
                  ? ref.t('filters.anyPrice')
                  : Money.format(widget.value, 'TZS'),
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: K.brand),
            ),
          ],
        ),
        const SizedBox(height: K.s10),

        // The ladder, plus the two ways out of it.
        Wrap(
          spacing: 7,
          runSpacing: 7,
          children: [
            _Chip(
              label: ref.t('filters.anyPrice'),
              selected: widget.value == null && !_custom,
              onTap: () {
                setState(() => _custom = false);
                _apply(null);
              },
            ),
            for (final rung in _ladder)
              _Chip(
                label: ref.t('filters.under', {'amount': Money.compact(rung)}),
                selected: !_custom && widget.value == rung,
                onTap: () {
                  setState(() => _custom = false);
                  _apply(rung);
                },
              ),
            _Chip(
              label: ref.t('filters.custom'),
              selected: _custom,
              onTap: () => setState(() => _custom = true),
            ),
          ],
        ),

        if (_custom) ...[
          const SizedBox(height: K.s12),
          Focus(
            onFocusChange: (has) => _hasFocus = has,
            child: TextField(
              controller: _controller,
              keyboardType: const TextInputType.numberWithOptions(decimal: false),
              // Digits only: what leaves this field is a number, so the field
              // never has to guess what a stray character meant.
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                prefixText: 'TZS  ',
                prefixStyle: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: K.inkMuted,
                ),
                hintText: Money.amountOnly(ceiling.round()),
                suffixIcon: _controller.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close_rounded, size: 17),
                        onPressed: () => _apply(null),
                      ),
              ),
              onChanged: (raw) {
                final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
                final parsed = digits.isEmpty ? null : double.tryParse(digits);
                // Re-group as they type, keeping the caret at the end.
                final grouped = parsed == null ? '' : Money.amountOnly(parsed.round());
                if (grouped != raw) {
                  _controller.value = TextEditingValue(
                    text: grouped,
                    selection: TextSelection.collapsed(offset: grouped.length),
                  );
                }
                _apply(parsed, fromField: true);
              },
            ),
          ),
        ],

        if (usable) ...[
          const SizedBox(height: K.s4),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 3,
              activeTrackColor: K.brand,
              inactiveTrackColor: K.brand100,
              thumbColor: K.brand,
              overlayColor: K.brand.withValues(alpha: 0.12),
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 9),
            ),
            child: Slider(
              value: current.clamp(floor, ceiling),
              min: floor,
              max: ceiling,
              // Step of one shilling. A coarse step snaps 1,500,000 to
              // 1,520,669 and the three controls stop agreeing.
              divisions: null,
              onChanged: (next) => setState(() {
                _controller.text = _grouped(_normalise(next));
              }),
              onChangeEnd: (next) => _apply(next),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                Money.format(floor, 'TZS'),
                style: const TextStyle(fontSize: 11, color: K.inkFaint),
              ),
              Text(
                Money.format(ceiling, 'TZS'),
                style: const TextStyle(fontSize: 11, color: K.inkFaint),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? K.brand : K.surface,
      borderRadius: K.radius(K.rPill),
      child: InkWell(
        onTap: onTap,
        borderRadius: K.radius(K.rPill),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: K.radius(K.rPill),
            border: Border.all(color: selected ? K.brand : K.lineStrong),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: selected ? Colors.white : K.inkSoft,
            ),
          ),
        ),
      ),
    );
  }
}
