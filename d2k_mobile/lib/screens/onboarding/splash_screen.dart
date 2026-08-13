import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../state/app_controllers.dart';
import '../../state/cart_controller.dart';
import '../../state/currency_controller.dart';
import '../shell/app_shell.dart';
import 'language_select_screen.dart';

/// Brand yellow splash with the D2K mark and the reference's spinning ring.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final started = DateTime.now();
    final location = context.read<LocationController>();

    await Future.wait([
      context.read<CurrencyController>().load(),
      context.read<CartController>().load(),
      context.read<WishlistController>().load(),
      context.read<AppSettingsController>().load(),
      context.read<BrowsingHistoryController>().load(),
      location.load(),
    ]);

    // Keep the splash on screen long enough to read, like the reference.
    final elapsed = DateTime.now().difference(started);
    const minimum = Duration(milliseconds: 1400);
    if (elapsed < minimum) {
      await Future<void>.delayed(minimum - elapsed);
    }
    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 420),
        pageBuilder: (_, __, ___) =>
            location.onboarded ? const AppShell() : const LanguageSelectScreen(),
        transitionsBuilder: (_, animation, __, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: AppColors.brandYellow,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                'assets/images/d2k_logo.png',
                width: 132,
                height: 132,
                fit: BoxFit.contain,
              ),
              const SizedBox(height: 34),
              RotationTransition(
                turns: _spin,
                child: const SizedBox(
                  width: 34,
                  height: 34,
                  child: CircularProgressIndicator(
                    strokeWidth: 3.4,
                    strokeCap: StrokeCap.round,
                    valueColor:
                        AlwaysStoppedAnimation<Color>(AppColors.brandBlack),
                    backgroundColor: Color(0x1A000000),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
