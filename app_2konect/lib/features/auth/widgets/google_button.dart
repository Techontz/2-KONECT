import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/brand.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/tokens.dart';
import '../../../models/account.dart';
import '../../../providers/language.dart';
import '../../../providers/session.dart';
import '../../../services/firebase_identity.dart';
import 'auth_field.dart';

/// "Continue with Google" for shoppers.
///
/// Google → Firebase → Firebase ID token → Laravel → Sanctum. The button owns
/// only the first hop; the moment a token exists it is handed to the session
/// controller, which persists the Sanctum session exactly as a password login
/// does. There is no second authentication system, and no Socialite.
///
/// The control is drawn from the storefront's own tokens — radius, border,
/// type scale — rather than Google's rendered widget, so it sits inside the
/// sheet instead of importing a second design language. Google's mark is the
/// one part reproduced to their spec.
class GoogleButton extends ConsumerStatefulWidget {
  const GoogleButton({super.key, required this.onSignedIn});

  final ValueChanged<AuthUser> onSignedIn;

  @override
  ConsumerState<GoogleButton> createState() => _GoogleButtonState();
}

class _GoogleButtonState extends ConsumerState<GoogleButton> {
  bool _busy = false;
  String? _error;

  Future<void> _start() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final user = await ref.read(sessionProvider.notifier).signInWithGoogle();
      // Null means the customer dismissed the account picker. That is a
      // decision, not a failure, and must not be reported as one.
      if (user == null) {
        if (mounted) setState(() => _busy = false);
        return;
      }
      widget.onSignedIn(user);
    } on FirebaseIdentityUnavailable {
      // Configuration, not user error — say so plainly rather than leaving
      // them tapping a button that cannot work.
      if (mounted) {
        setState(() {
          _busy = false;
          _error = ref.read(tProvider)('auth.googleUnavailable');
        });
      }
      return;
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        // A seller or staff email is refused by the backend by design, and
        // its message explains what to do instead — so it is surfaced
        // verbatim. Anything without a message falls back to the honest
        // generic line.
        _error = error.isOffline
            ? ref.read(tProvider)('auth.googleNetwork')
            : error.message;
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.read(tProvider)('auth.googleFailed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: K.s20),
        Row(
          children: [
            const Expanded(child: Divider(color: K.line)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: K.s12),
              child: Text(
                ref.t('auth.or').toUpperCase(),
                style: const TextStyle(
                  fontFamily: K.fontFamily,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.6,
                  color: K.inkFaint,
                ),
              ),
            ),
            const Expanded(child: Divider(color: K.line)),
          ],
        ),
        const SizedBox(height: K.s12),
        SizedBox(
          height: 48,
          child: OutlinedButton(
            onPressed: _busy ? null : _start,
            style: OutlinedButton.styleFrom(
              backgroundColor: K.surface,
              foregroundColor: K.ink,
              side: const BorderSide(color: K.lineStrong),
              shape: RoundedRectangleBorder(borderRadius: K.radius(K.rSm)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (_busy)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  const GoogleMark(),
                const SizedBox(width: K.s10),
                Flexible(
                  child: Text(
                    _busy
                        ? ref.t('auth.pleaseWait')
                        : ref.t('auth.continueWithGoogle'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: K.fontFamily,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: K.s10),
          AuthNotice(message: _error!, tone: AuthNoticeTone.danger),
          if (!FirebaseIdentity.instance.available) ...[
            const SizedBox(height: K.s6),
            Text(
              ref.t('app.googleSetupHint', {'brand': Brand.name}),
              style: const TextStyle(
                fontFamily: K.fontFamily,
                fontSize: 11,
                height: 1.45,
                color: K.inkFaint,
              ),
            ),
          ],
        ],
      ],
    );
  }
}

/// Google's mark, reproduced to their brand spec.
///
/// Drawn rather than fetched: the four arcs are Google's, and shipping them as
/// paths keeps the button working with no network asset and no second design
/// language imported into the sheet.
class GoogleMark extends StatelessWidget {
  const GoogleMark({super.key, this.size = 18});

  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: CustomPaint(painter: _GoogleMarkPainter()),
      );
}

class _GoogleMarkPainter extends CustomPainter {
  static const _blue = Color(0xFF4285F4);
  static const _green = Color(0xFF34A853);
  static const _yellow = Color(0xFFFBBC05);
  static const _red = Color(0xFFEA4335);

  /// The four paths from Google's own 18×18 mark, scaled to the widget.
  static const _blueD =
      'M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z';
  static const _greenD =
      'M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z';
  static const _yellowD =
      'M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z';
  static const _redD =
      'M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z';

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 18;
    canvas.save();
    canvas.scale(scale);

    void draw(String d, Color colour) {
      canvas.drawPath(
        _parse(d),
        Paint()
          ..color = colour
          ..style = PaintingStyle.fill
          ..isAntiAlias = true,
      );
    }

    draw(_blueD, _blue);
    draw(_greenD, _green);
    draw(_yellowD, _yellow);
    draw(_redD, _red);
    canvas.restore();
  }

  /// A minimal SVG path reader — enough for these four arcs (M, m, C, c, A, a,
  /// L, l, H, h, V, v, Z). Kept here rather than pulled from a package because
  /// four constant paths do not justify a dependency.
  static Path _parse(String d) {
    final path = Path();
    final tokens = RegExp(r'([MmLlHhVvCcSsAaZz])|(-?\d*\.?\d+(?:e-?\d+)?)')
        .allMatches(d)
        .toList();

    var i = 0;
    var x = 0.0;
    var y = 0.0;
    var startX = 0.0;
    var startY = 0.0;
    String? command;

    double next() => double.parse(tokens[i++].group(0)!);
    bool isCommand() => tokens[i].group(1) != null;

    while (i < tokens.length) {
      if (isCommand()) command = tokens[i++].group(1);
      if (command == null) break;

      switch (command) {
        case 'M':
        case 'm':
          final relative = command == 'm';
          final nx = next(), ny = next();
          x = relative ? x + nx : nx;
          y = relative ? y + ny : ny;
          path.moveTo(x, y);
          startX = x;
          startY = y;
          command = relative ? 'l' : 'L';
        case 'L':
        case 'l':
          final relative = command == 'l';
          final nx = next(), ny = next();
          x = relative ? x + nx : nx;
          y = relative ? y + ny : ny;
          path.lineTo(x, y);
        case 'H':
        case 'h':
          final nx = next();
          x = command == 'h' ? x + nx : nx;
          path.lineTo(x, y);
        case 'V':
        case 'v':
          final ny = next();
          y = command == 'v' ? y + ny : ny;
          path.lineTo(x, y);
        case 'C':
        case 'c':
          final relative = command == 'c';
          final x1 = next(), y1 = next(), x2 = next(), y2 = next();
          final nx = next(), ny = next();
          path.cubicTo(
            relative ? x + x1 : x1,
            relative ? y + y1 : y1,
            relative ? x + x2 : x2,
            relative ? y + y2 : y2,
            relative ? x + nx : nx,
            relative ? y + ny : ny,
          );
          x = relative ? x + nx : nx;
          y = relative ? y + ny : ny;
        case 'A':
        case 'a':
          final relative = command == 'a';
          final rx = next(), ry = next();
          next(); // x-axis rotation — always 0 in these four paths
          final largeArc = next() != 0;
          final sweep = next() != 0;
          final nx = next(), ny = next();
          x = relative ? x + nx : nx;
          y = relative ? y + ny : ny;
          path.arcToPoint(
            Offset(x, y),
            radius: Radius.elliptical(rx, ry),
            largeArc: largeArc,
            clockwise: sweep,
          );
        case 'Z':
        case 'z':
          path.close();
          x = startX;
          y = startY;
        default:
          i++;
      }
    }

    return path;
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
