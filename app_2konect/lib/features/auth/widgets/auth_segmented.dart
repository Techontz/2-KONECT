import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';

/// The Login / Sign up switch.
///
/// The website draws a two-cell segmented control — a `line-strong` border, a
/// 1px inset, and the active half filled brand navy. This is the same control,
/// with the fill *sliding* between the halves rather than jumping: on a phone
/// the two modes are one surface the reader is moving through, and a fill that
/// travels says that where an instant recolour does not.
class AuthSegmented extends StatelessWidget {
  const AuthSegmented({
    super.key,
    required this.labels,
    required this.index,
    required this.onChanged,
  });

  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: K.surface,
        borderRadius: K.radius(K.rSm),
        border: Border.all(color: K.lineStrong),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final cell = constraints.maxWidth / labels.length;

          return SizedBox(
            height: 40,
            child: Stack(
              children: [
                // The travelling fill.
                AnimatedPositioned(
                  duration: K.normal,
                  curve: K.easing,
                  left: cell * index,
                  top: 0,
                  bottom: 0,
                  width: cell,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: K.brand,
                      borderRadius: K.radius(K.rXs),
                    ),
                  ),
                ),
                Row(
                  children: [
                    for (var i = 0; i < labels.length; i++)
                      Expanded(
                        child: Semantics(
                          selected: i == index,
                          button: true,
                          child: InkWell(
                            onTap: () => onChanged(i),
                            borderRadius: K.radius(K.rXs),
                            child: Center(
                              // The label crossfades to white as the fill
                              // arrives under it, so the two never disagree
                              // about which half is active.
                              child: AnimatedDefaultTextStyle(
                                duration: K.normal,
                                curve: K.easing,
                                style: TextStyle(
                                  fontFamily: K.fontFamily,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: i == index ? Colors.white : K.inkMuted,
                                ),
                                child: Text(labels[i]),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
