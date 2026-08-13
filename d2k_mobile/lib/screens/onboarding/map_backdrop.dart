import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_typography.dart';

/// A stylised East-African map used behind the country and location pickers.
///
/// The reference shows a real map surface there; D2K ships a lightweight
/// painted equivalent so onboarding has no third-party map dependency, while
/// keeping the same visual weight (pale land, soft water, muted place labels).
class MapBackdrop extends StatelessWidget {
  const MapBackdrop({super.key, this.labels = const [], this.zoom = 1});

  final List<String> labels;
  final double zoom;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFFCFE7F7), Color(0xFFB9DCF2)],
            ),
          ),
        ),
        CustomPaint(painter: _MapPainter(zoom: zoom)),
        if (labels.isNotEmpty)
          LayoutBuilder(
            builder: (context, constraints) {
              final rng = math.Random(7);
              return Stack(
                children: [
                  for (var i = 0; i < labels.length; i++)
                    Positioned(
                      left: constraints.maxWidth *
                          (0.12 + rng.nextDouble() * 0.62),
                      top: constraints.maxHeight *
                          (0.10 + rng.nextDouble() * 0.55),
                      child: Text(
                        labels[i],
                        style: AppTypography.metaMuted.copyWith(
                          fontSize: 12,
                          color: const Color(0xFF54606E),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
      ],
    );
  }
}

class _MapPainter extends CustomPainter {
  const _MapPainter({required this.zoom});

  final double zoom;

  @override
  void paint(Canvas canvas, Size size) {
    final land = Paint()..color = const Color(0xFFEFF1F3);
    final border = Paint()
      ..color = const Color(0xFFD3D9DE)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final road = Paint()
      ..color = const Color(0xFFFFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    final w = size.width;
    final h = size.height;

    // Continental mass on the left two thirds.
    final mainland = Path()
      ..moveTo(-w * 0.1, h * 0.06)
      ..cubicTo(w * 0.30, h * 0.02, w * 0.52, h * 0.16, w * 0.60, h * 0.30)
      ..cubicTo(w * 0.70, h * 0.44, w * 0.62, h * 0.60, w * 0.70, h * 0.74)
      ..cubicTo(w * 0.76, h * 0.86, w * 0.52, h * 0.96, w * 0.24, h * 1.02)
      ..lineTo(-w * 0.12, h * 1.05)
      ..close();
    canvas.drawPath(mainland, land);
    canvas.drawPath(mainland, border);

    // Island off the coast (Zanzibar / Pemba silhouettes).
    for (final spec in const [
      [0.80, 0.40, 0.055, 0.11],
      [0.86, 0.58, 0.035, 0.06],
    ]) {
      final rect = Rect.fromCenter(
        center: Offset(w * spec[0], h * spec[1]),
        width: w * spec[2] * 2,
        height: h * spec[3],
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, Radius.circular(w * 0.04)),
        land,
      );
    }

    // Internal borders.
    final divider = Paint()
      ..color = const Color(0xFFDBE0E5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawLine(
        Offset(w * 0.05, h * 0.34), Offset(w * 0.58, h * 0.30), divider);
    canvas.drawLine(
        Offset(w * 0.18, h * 0.68), Offset(w * 0.68, h * 0.72), divider);

    // A couple of trunk roads for texture.
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.02, h * 0.52)
        ..quadraticBezierTo(w * 0.34, h * 0.40, w * 0.66, h * 0.56),
      road,
    );
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.22, h * 0.14)
        ..quadraticBezierTo(w * 0.30, h * 0.52, w * 0.48, h * 0.92),
      road..strokeWidth = 2.2,
    );
  }

  @override
  bool shouldRepaint(_MapPainter oldDelegate) => oldDelegate.zoom != zoom;
}
