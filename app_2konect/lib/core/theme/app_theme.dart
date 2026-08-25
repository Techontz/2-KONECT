import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'tokens.dart';

/// The single ThemeData the app runs on.
///
/// A commerce surface is light: inheriting the OS dark preference would invert
/// product photography and wreck contrast on the navy. Fixed on purpose, which
/// is exactly what the website does (`color-scheme: light`).
class AppTheme {
  const AppTheme._();

  static ThemeData build() {
    // The family is set on the base rather than in copyWith, so every widget
    // Flutter styles for us — dialogs, menus, tooltips — inherits it too.
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: K.fontFamily,
    );

    const scheme = ColorScheme.light(
      primary: K.brand,
      onPrimary: K.brandInk,
      primaryContainer: K.brand100,
      onPrimaryContainer: K.brand,
      secondary: K.brand600,
      onSecondary: K.brandInk,
      surface: K.surface,
      onSurface: K.ink,
      surfaceContainerHighest: K.surfaceAlt,
      error: K.danger,
      onError: Colors.white,
      outline: K.line,
      outlineVariant: K.lineStrong,
    );

    return base.copyWith(
      colorScheme: scheme,
      scaffoldBackgroundColor: K.canvas,
      splashFactory: InkSparkle.splashFactory,
      // Headings are tight and heavy; the type does the work the colour does
      // not. Sizes are the phone step of the website's scale.
      textTheme: _text(base.textTheme),
      appBarTheme: const AppBarTheme(
        backgroundColor: K.brand,
        foregroundColor: K.brandInk,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
        titleTextStyle: TextStyle(
          fontFamily: K.fontFamily,
          color: K.brandInk,
          fontSize: 16.5,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.3,
        ),
      ),
      dividerTheme: const DividerThemeData(color: K.line, thickness: 1, space: 1),
      cardTheme: CardThemeData(
        color: K.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: K.radius(K.rMd),
          side: const BorderSide(color: K.line),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: K.brand,
          foregroundColor: K.brandInk,
          disabledBackgroundColor: K.brand200,
          disabledForegroundColor: K.inkFaint,
          minimumSize: const Size(0, 48),
          shape: RoundedRectangleBorder(borderRadius: K.radius(K.rSm)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: K.brand,
          minimumSize: const Size(0, 48),
          side: const BorderSide(color: K.lineStrong),
          shape: RoundedRectangleBorder(borderRadius: K.radius(K.rSm)),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: K.brand,
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: K.surface,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        hintStyle: const TextStyle(color: K.inkFaint, fontSize: 14, fontWeight: FontWeight.w400),
        labelStyle: const TextStyle(color: K.inkMuted, fontSize: 13, fontWeight: FontWeight.w600),
        border: _border(K.line),
        enabledBorder: _border(K.line),
        focusedBorder: _border(K.brand, width: 1.5),
        errorBorder: _border(K.danger),
        focusedErrorBorder: _border(K.danger, width: 1.5),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: K.surface,
        side: const BorderSide(color: K.line),
        labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: K.inkSoft),
        shape: RoundedRectangleBorder(borderRadius: K.radius(K.rPill)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: K.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(K.rLg)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: K.brandDeep,
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: K.radius(K.rSm)),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: K.brand),
      // The website never bounces; a phone should. Keep platform-native
      // physics rather than forcing one everywhere.
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      }),
    );
  }

  static OutlineInputBorder _border(Color c, {double width = 1}) => OutlineInputBorder(
        borderRadius: K.radius(K.rSm),
        borderSide: BorderSide(color: c, width: width),
      );

  static TextTheme _text(TextTheme base) => base
      .apply(
        bodyColor: K.ink,
        displayColor: K.ink,
        fontFamily: K.fontFamily,
      )
      .copyWith(
        /* One ramp, seven steps, nothing off it.
           Sizes and weights are the website's own: headings are `font-black`
           with -0.02em tracking, body is 400/500, and the only element that
           goes heavier than a heading is a price. */

        // Display — a hero line, and nothing else.
        headlineMedium: _s(26, FontWeight.w800, height: 1.15, tracking: -0.6),
        // Page heading.
        headlineSmall: _s(22, FontWeight.w800, height: 1.18, tracking: -0.44),
        // Section heading — the website's 18px font-black.
        titleLarge: _s(18, FontWeight.w800, height: 1.25, tracking: -0.36),
        // Panel heading.
        titleMedium: _s(15, FontWeight.w700, height: 1.3, tracking: -0.15),
        // Row heading.
        titleSmall: _s(13.5, FontWeight.w700, height: 1.35),
        // Body.
        bodyLarge: _s(15, FontWeight.w400, height: 1.5),
        bodyMedium: _s(13.5, FontWeight.w400, height: 1.5, color: K.inkSoft),
        // Caption / metadata.
        bodySmall: _s(12, FontWeight.w400, height: 1.45, color: K.inkMuted),
        labelLarge: _s(14, FontWeight.w700),
        labelMedium: _s(12, FontWeight.w600, color: K.inkMuted),
        labelSmall: _s(10.5, FontWeight.w700, color: K.inkFaint, tracking: 0.2),
      );

  static TextStyle _s(
    double size,
    FontWeight weight, {
    double? height,
    double? tracking,
    Color color = K.ink,
  }) =>
      TextStyle(
        fontFamily: K.fontFamily,
        fontSize: size,
        fontWeight: weight,
        height: height,
        letterSpacing: tracking,
        color: color,
      );
}

/// The type ramp, reachable without a BuildContext.
///
/// Screens read these directly so a size is never typed inline — the previous
/// pass had a dozen one-off `TextStyle(fontSize: 12.5)` declarations, which is
/// how a ramp quietly stops being one.
class KType {
  const KType._();

  /// A price. The only thing in the app heavier than a heading, because in a
  /// grid it is the second thing the eye lands on after the photograph.
  static TextStyle price(double size) => TextStyle(
        fontFamily: K.fontFamily,
        fontSize: size,
        fontWeight: FontWeight.w800,
        height: 1.15,
        letterSpacing: size * -0.02,
        color: K.ink,
      );

  /// A product name in a grid: 12.5px medium, two lines, on soft ink.
  static const cardTitle = TextStyle(
    fontFamily: K.fontFamily,
    fontSize: 12.5,
    fontWeight: FontWeight.w500,
    height: 1.36,
    color: K.inkSoft,
  );

  /// The struck-through original price.
  static const wasPrice = TextStyle(
    fontFamily: K.fontFamily,
    fontSize: 11,
    fontWeight: FontWeight.w400,
    height: 1.2,
    color: K.inkFaint,
    decoration: TextDecoration.lineThrough,
    decorationColor: K.inkFaint,
  );

  /// Card metadata — the seller's name, a stock count.
  static const meta = TextStyle(
    fontFamily: K.fontFamily,
    fontSize: 10.5,
    fontWeight: FontWeight.w500,
    height: 1.4,
    color: K.inkFaint,
  );

  /// The uppercase micro-label inside a Tag.
  static const tag = TextStyle(
    fontFamily: K.fontFamily,
    fontSize: 10,
    fontWeight: FontWeight.w700,
    height: 1.2,
    letterSpacing: 0.3,
  );

  /// The availability band under a product photograph.
  static const strip = TextStyle(
    fontFamily: K.fontFamily,
    fontSize: 11,
    fontWeight: FontWeight.w700,
    height: 1.0,
  );
}
