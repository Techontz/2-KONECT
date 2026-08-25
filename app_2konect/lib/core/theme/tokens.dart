import 'package:flutter/material.dart';

/// The 2KONECT design system, ported one-for-one from `2k-web/app/globals.css`.
///
/// Every colour, radius, shadow and gap the storefront uses is declared once
/// there; this file is the Dart mirror of it so the phone and the website are
/// literally the same palette rather than two approximations of one.
///
/// The system is built from #1B2C3E — a deep, desaturated navy that carries
/// the brand by being the darkest thing on the screen rather than the loudest.
class K {
  const K._();

  /* --- Brand ----------------------------------------------------------- */
  static const brand = Color(0xFF1B2C3E);
  static const brandStrong = Color(0xFF142232);
  static const brandDeep = Color(0xFF0D1A26);
  static const brand600 = Color(0xFF27405A);
  static const brand400 = Color(0xFF5A748F);
  static const brand300 = Color(0xFF9FB2C4);
  static const brand200 = Color(0xFFD3DCE6);
  static const brand100 = Color(0xFFE8EEF4);
  static const brand50 = Color(0xFFF4F7FA);
  static const brandInk = Color(0xFFFFFFFF);

  /* --- Ink -------------------------------------------------------------- */
  static const ink = Color(0xFF101923);
  static const inkSoft = Color(0xFF35414F);
  static const inkMuted = Color(0xFF55616F);
  static const inkFaint = Color(0xFF626D79);

  /* --- Surfaces --------------------------------------------------------- */
  static const canvas = Color(0xFFF4F6F8);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceAlt = Color(0xFFFAFBFC);
  static const line = Color(0xFFE4E8EC);
  static const lineStrong = Color(0xFFCFD6DD);

  /* --- Availability -----------------------------------------------------
     The distinction the whole marketplace is organised around, and the one
     pair of colours that must never be mistaken for the brand. Local is a
     settled green — it is here. Import is an airmail blue — it is coming. */
  static const local = Color(0xFF0F7A52);
  static const localSoft = Color(0xFFE7F6EF);
  static const localLine = Color(0xFFBCE5D4);
  static const import = Color(0xFF1668C7);
  static const importSoft = Color(0xFFE9F1FD);
  static const importLine = Color(0xFFC2D8F6);

  /* --- Semantic --------------------------------------------------------- */
  static const sale = Color(0xFFD81F45);
  static const saleSoft = Color(0xFFFDF0F3);
  static const success = Color(0xFF0F7A52);
  static const successSoft = Color(0xFFE7F6EF);
  static const warn = Color(0xFFA45309);
  static const warnSoft = Color(0xFFFDF2DC);
  static const danger = Color(0xFFC62828);
  static const dangerSoft = Color(0xFFFDEAEA);
  static const verified = Color(0xFF1668C7);

  /* --- Radii ------------------------------------------------------------
     Flatter than a typical app. The reference builds its cards out of
     hairlines and right angles; a 28px radius on a product tile reads as a
     toy. */
  static const rXs = 4.0;
  static const rSm = 6.0;
  static const rMd = 10.0;
  static const rLg = 14.0;
  static const rXl = 20.0;
  static const rPill = 999.0;

  /* --- Elevation --------------------------------------------------------
     Border-first. A commerce grid separated by hairlines stays legible; the
     same grid separated by shadows turns to soup. */
  static const shadowCard = <BoxShadow>[
    BoxShadow(color: Color(0x0D101923), blurRadius: 2, offset: Offset(0, 1)),
  ];
  static const shadowHover = <BoxShadow>[
    BoxShadow(color: Color(0x1A101923), blurRadius: 20, offset: Offset(0, 6)),
  ];
  static const shadowPop = <BoxShadow>[
    BoxShadow(color: Color(0x29101923), blurRadius: 40, offset: Offset(0, 16)),
  ];

  /* --- Spacing rhythm ---------------------------------------------------
     Sections are separated by one of two gaps and nothing else, which is what
     gives a long home screen a pulse instead of a drift. */
  static const gapSection = 28.0;
  static const gapSectionLg = 44.0;

  /* --- Layout ----------------------------------------------------------- */
  static const tabBarHeight = 62.0;

  /* --- Spacing scale ----------------------------------------------------
     One scale, and nothing off it. The previous pass had 3px here, 11px
     there and 19px somewhere else, which is what makes a screen look
     assembled rather than designed. Every gap in the app is one of these. */
  static const s2 = 2.0;
  static const s4 = 4.0;
  static const s6 = 6.0;
  static const s8 = 8.0;
  static const s10 = 10.0;
  static const s12 = 12.0;
  static const s14 = 14.0;
  static const s16 = 16.0;
  static const s20 = 20.0;
  static const s24 = 24.0;
  static const s28 = 28.0;

  /// The screen gutter. 16px, the same as the website's `.shell`.
  static const gutter = 16.0;

  /* --- Typeface ---------------------------------------------------------
     Plus Jakarta Sans, the website's own. It has a genuine 800 that holds up
     at display sizes and a 500 that keeps a product name legible at 12.5px,
     which is the whole reason the reference chose it. */
  static const fontFamily = 'PlusJakartaSans';

  /* --- Motion -----------------------------------------------------------
     Short and subtle. Anything longer than this reads as the interface
     getting in the way of the shop. */
  static const fast = Duration(milliseconds: 150);
  static const normal = Duration(milliseconds: 220);
  static const slow = Duration(milliseconds: 300);
  static const easing = Cubic(0.22, 1, 0.36, 1);

  /* --- Convenience ------------------------------------------------------ */
  static BorderRadius radius(double r) => BorderRadius.circular(r);

  /// The hairline every card, row and field is drawn with.
  static Border get hairline => Border.all(color: line, width: 1);

  /// The tint, border and ink a sourcing type carries — everywhere, without
  /// exception. Local is a settled green; import is an airmail blue.
  static ({Color ink, Color soft, Color line}) sourcingTone(bool isLocal) => isLocal
      ? (ink: local, soft: localSoft, line: localLine)
      : (ink: import, soft: importSoft, line: importLine);

  static Border hairlineOf(Color c) => Border.all(color: c, width: 1);
}
