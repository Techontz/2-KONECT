import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/tokens.dart';
import '../../../models/catalog.dart';
import '../../../providers/language.dart';
import '../../../widgets/banner_image.dart';

/// The top of the home screen: the campaigns an administrator has published.
///
/// The website renders these as a bare image, because in a browser the vector
/// artwork draws its own headline perfectly. On a phone it does not — see
/// [BannerImage.withoutCopyLayer] — so the plate is rendered without its copy
/// layer and the wording is drawn here instead, from the very same
/// `title` / `subtitle` / `cta_label` fields the API already sends. Every word
/// is still the administrator's; only the typesetting is ours, and it is in
/// the brand face rather than in whatever the handset substitutes.
///
/// Geometry is the website's `aspect-[1200/400]` — the viewBox the artwork is
/// authored at — so nothing is stretched or cropped through the copy.
class HeroCarousel extends ConsumerStatefulWidget {
  const HeroCarousel({super.key, required this.banners});

  final List<HeroBanner> banners;

  /// The authored aspect of every campaign plate: `viewBox="0 0 1200 400"`.
  static const aspect = 1200 / 400;

  /// The website advances every six seconds. Matched rather than guessed, so
  /// a shopper who uses both does not learn two different rhythms.
  static const _interval = Duration(seconds: 6);

  @override
  ConsumerState<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends ConsumerState<HeroCarousel> {
  final _controller = PageController(viewportFraction: 0.93);
  Timer? _timer;
  int _index = 0;

  /// True while a finger is on the rail. A carousel that moves out from under
  /// a reader is a bug, not a feature.
  bool _held = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _retime();
  }

  void _retime() {
    _timer?.cancel();
    if (widget.banners.length < 2) return;
    // Anyone who has asked their system to calm down keeps the first slide and
    // the dots, and nothing moves by itself — the same rule the website
    // applies with `prefers-reduced-motion`.
    if (MediaQuery.disableAnimationsOf(context)) return;

    _timer = Timer.periodic(HeroCarousel._interval, (_) {
      if (!mounted || _held || !_controller.hasClients) return;
      _controller.animateToPage(
        (_index + 1) % widget.banners.length,
        duration: K.slow,
        curve: K.easing,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) return const SizedBox.shrink();

    // The plate's own width, once the viewport fraction and the gutter between
    // slides are taken off — the height follows from the authored aspect, so
    // the artwork is never squeezed.
    final width = MediaQuery.sizeOf(context).width * 0.93 - K.s8;
    final height = width / HeroCarousel.aspect;

    return SizedBox(
      height: height,
      child: Listener(
        onPointerDown: (_) => _held = true,
        onPointerUp: (_) => _held = false,
        onPointerCancel: (_) => _held = false,
        child: PageView.builder(
          controller: _controller,
          itemCount: widget.banners.length,
          onPageChanged: (i) => setState(() => _index = i),
          itemBuilder: (context, index) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: K.s4),
            child: _Plate(
              banner: widget.banners[index],
              // Only the slide in view carries the dots, so they do not slide
              // away with the artwork behind them.
              dots: widget.banners.length > 1
                  ? (count: widget.banners.length, active: _index)
                  : null,
              onDot: (dot) => _controller.animateToPage(
                dot,
                duration: K.normal,
                curve: K.easing,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One campaign, linked if it has somewhere to go.
class _Plate extends ConsumerWidget {
  const _Plate({required this.banner, required this.dots, required this.onDot});

  final HeroBanner banner;
  final ({int count, int active})? dots;
  final ValueChanged<int> onDot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final artwork = banner.artwork;
    // Raster artwork keeps whatever wording is baked into it, exactly as the
    // website treats it; only vector artwork has a copy layer that can be
    // lifted out and re-set.
    final vector = artwork != null && BannerImage.isVector(artwork);

    final plate = Stack(
      fit: StackFit.expand,
      children: [
        BannerImage(
          // `mobile_image` first, which the server already falls back to the
          // desktop crop for when no phone artwork is uploaded.
          url: artwork,
          semanticLabel: banner.alt ?? banner.title,
          stripCopy: vector,
        ),
        // A scrim, but only under copy this app is drawing.
        //
        // The website needs none: its text is baked into the artwork with
        // whatever contrast the designer chose for that plate. Ours is not —
        // and the plates genuinely differ, "Order from abroad" being deep navy
        // while "In stock" is near-white. Without this, white type is
        // invisible on half the campaigns. It is anchored to the copy column
        // and fades out well before the decorative mark, so artwork that
        // carries its own light is not needlessly darkened.
        if (vector) ...[
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  Color(0xF50D1A26),
                  Color(0xE60D1A26),
                  Color(0xA60D1A26),
                  Color(0x000D1A26),
                ],
                // Clear by 0.88 rather than 1.0: the copy column ends around
                // two-thirds across, and running the scrim to the far edge
                // washed out the decorative mark the artwork is built around.
                stops: [0.0, 0.45, 0.70, 0.88],
              ),
            ),
          ),
          _Copy(banner: banner),
        ],
        if (dots != null)
          Positioned(
            left: 0,
            right: 0,
            bottom: K.s12,
            child: _Dots(
              count: dots!.count,
              active: dots!.active,
              onTap: onDot,
              label: ref.t('home.featuredCampaigns'),
            ),
          ),
      ],
    );

    final rounded = ClipRRect(
      borderRadius: K.radius(K.rLg),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: K.radius(K.rLg),
          border: K.hairline,
        ),
        child: plate,
      ),
    );

    final link = banner.link;
    if (link == null || link.isEmpty) return rounded;

    return Semantics(
      button: true,
      label: banner.title,
      child: Material(
        color: Colors.transparent,
        borderRadius: K.radius(K.rLg),
        clipBehavior: Clip.antiAlias,
        child: InkWell(onTap: () => _open(context, link), child: rounded),
      ),
    );
  }

  /// Banner links are authored for the website. The ones that map onto a
  /// screen this app has are followed; anything else is ignored rather than
  /// throwing the shopper out into a browser mid-shop.
  static void _open(BuildContext context, String link) {
    final uri = Uri.tryParse(link);
    if (uri == null) return;

    final path = uri.path;
    final id = uri.queryParameters['id'];

    if (path.startsWith('/product') && id != null) {
      context.push('/product/$id');
    } else if (path.startsWith('/category') && id != null) {
      context.push('/category/$id');
    } else if (path.startsWith('/deals')) {
      context.push('/shop?on_sale=1');
    } else if (path.startsWith('/shop/local')) {
      context.push('/shop?availability=local');
    } else if (path.startsWith('/shop/abroad')) {
      context.push('/shop?availability=import');
    } else if (path.startsWith('/shop')) {
      context.push('/shop');
    } else if (path.startsWith('/request')) {
      context.push('/request');
    } else if (path.startsWith('/vendors')) {
      context.push('/vendors');
    } else if (path.startsWith('/categories')) {
      context.push('/categories');
    }
  }
}

/// The campaign wording, set in the brand face over the artwork.
///
/// Laid out to the same rhythm the artwork itself uses — headline, one line of
/// supporting copy, then the call to action — and sized against the plate so a
/// campaign reads the same on a small phone as on a large one.
class _Copy extends StatelessWidget {
  const _Copy({required this.banner});

  final HeroBanner banner;

  @override
  Widget build(BuildContext context) {
    final title = banner.title;
    final subtitle = banner.subtitle;
    final cta = banner.ctaLabel;

    if ((title ?? '').isEmpty && (subtitle ?? '').isEmpty) {
      return const SizedBox.shrink();
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        // Sized against the plate's **height**, not its width. A campaign
        // plate is 3:1, so width-derived type is three times too large for the
        // room it has to sit in — which is exactly how the first attempt
        // clipped its own headline.
        final h = constraints.maxHeight;
        final inset = h * 0.14;
        final headline = (h * 0.135).clamp(13.0, 22.0);
        final body = (h * 0.082).clamp(9.5, 13.0);

        return Padding(
          padding: EdgeInsets.only(
            left: inset,
            top: inset * 0.7,
            // The artwork keeps its right-hand third for the decorative mark.
            right: constraints.maxWidth * 0.30,
            // Clear of the page indicator, which sits centred along the base.
            bottom: inset * 0.7 + K.s14,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            // The whole block scales as one rather than each line clipping
            // independently. A campaign with a long headline in a language
            // that runs longer than English shrinks proportionally and stays
            // legible — it can never be cut off mid-word.
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: constraints.maxWidth * 0.66),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if ((title ?? '').isNotEmpty)
                      Text(
                        title!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: K.fontFamily,
                          fontSize: headline,
                          height: 1.14,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.4,
                          color: Colors.white,
                        ),
                      ),
                    if ((subtitle ?? '').isNotEmpty) ...[
                      SizedBox(height: h * 0.04),
                      Text(
                        subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: K.fontFamily,
                          fontSize: body,
                          height: 1.35,
                          fontWeight: FontWeight.w500,
                          // The artwork sets its own supporting line at 78%;
                          // the same value keeps it a subtitle rather than a
                          // second headline.
                          color: Colors.white.withValues(alpha: 0.78),
                        ),
                      ),
                    ],
                    if ((cta ?? '').isNotEmpty) ...[
                      SizedBox(height: h * 0.075),
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: body * 1.15,
                          vertical: body * 0.5,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: K.radius(K.rPill),
                        ),
                        child: Text(
                          cta!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: K.fontFamily,
                            fontSize: body,
                            height: 1.2,
                            fontWeight: FontWeight.w800,
                            color: K.brand,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The page indicator, drawn **inside** the plate as the website draws it:
/// white on the artwork, the active one stretched rather than recoloured.
class _Dots extends StatelessWidget {
  const _Dots({
    required this.count,
    required this.active,
    required this.onTap,
    required this.label,
  });

  final int count;
  final int active;
  final ValueChanged<int> onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < count; i++)
            GestureDetector(
              onTap: () => onTap(i),
              behavior: HitTestBehavior.opaque,
              child: Padding(
                // The visible dot is 6px tall; the padding gives it a target a
                // thumb can actually hit.
                padding: const EdgeInsets.symmetric(horizontal: 3, vertical: K.s10),
                child: AnimatedContainer(
                  duration: K.normal,
                  curve: K.easing,
                  width: i == active ? 24 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: i == active ? Colors.white : Colors.white.withValues(alpha: 0.55),
                    borderRadius: K.radius(K.rPill),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
