import 'package:flutter/material.dart';

import '../../../core/format.dart';
import '../../../core/theme/tokens.dart';
import '../../../models/order.dart';

/// The order journey: receipt, supplier, freight, customs, warehouse, door.
///
/// The server composes the steps and names an icon for each; this maps that
/// name to a glyph and draws the rail. An import's journey is genuinely longer
/// than a local one's, and showing it in full is what makes a three-week wait
/// legible rather than alarming.
class OrderTimeline extends StatelessWidget {
  const OrderTimeline({super.key, required this.steps});

  final List<TimelineStep> steps;

  static const _icons = <String, IconData>{
    'receipt': Icons.receipt_long_rounded,
    'check': Icons.check_circle_rounded,
    'box': Icons.inventory_2_rounded,
    'package': Icons.inventory_2_rounded,
    'plane': Icons.flight_rounded,
    'ship': Icons.directions_boat_rounded,
    'truck': Icons.local_shipping_rounded,
    'customs': Icons.gavel_rounded,
    'warehouse': Icons.warehouse_rounded,
    'home': Icons.home_rounded,
    'card': Icons.credit_card_rounded,
    'clock': Icons.schedule_rounded,
    'cancel': Icons.cancel_rounded,
  };

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var index = 0; index < steps.length; index++)
          _Step(
            step: steps[index],
            isFirst: index == 0,
            isLast: index == steps.length - 1,
          ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.step, required this.isFirst, required this.isLast});

  final TimelineStep step;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final done = step.isDone;
    final current = step.isCurrent;
    final colour = done
        ? K.success
        : current
            ? K.brand
            : K.lineStrong;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The rail.
          SizedBox(
            width: 30,
            child: Column(
              children: [
                Container(
                  width: 2,
                  height: 4,
                  color: isFirst ? Colors.transparent : (done ? K.success : K.line),
                ),
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: done || current ? colour : K.surface,
                    shape: BoxShape.circle,
                    border: Border.all(color: done || current ? colour : K.lineStrong, width: 1.5),
                  ),
                  child: Icon(
                    OrderTimeline._icons[step.icon] ?? Icons.circle,
                    size: 13,
                    color: done || current ? Colors.white : K.lineStrong,
                  ),
                ),
                Expanded(
                  child: Container(
                    width: 2,
                    color: isLast ? Colors.transparent : (done ? K.success : K.line),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: K.s12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 5, bottom: isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    step.title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: current ? FontWeight.w800 : FontWeight.w700,
                      color: done || current ? K.ink : K.inkFaint,
                    ),
                  ),
                  if (step.note != null && step.note!.isNotEmpty) ...[
                    const SizedBox(height: K.s2),
                    Text(
                      step.note!,
                      style: const TextStyle(fontSize: 11.5, height: 1.45, color: K.inkMuted),
                    ),
                  ],
                  if (step.happenedAt != null || step.location != null) ...[
                    const SizedBox(height: K.s4),
                    Text(
                      [
                        if (step.happenedAt != null) Dates.withTime(step.happenedAt),
                        if (step.location != null) step.location!,
                      ].join(' · '),
                      style: const TextStyle(fontSize: 10.5, color: K.inkFaint),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
