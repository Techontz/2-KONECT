import 'dart:async';

import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';
import '../domain/models/catalog.dart';
import 'app_image.dart';

/// The slim gradient promo strip that sits between the search bar and the hero
/// carousel. Auto-advances and peeks the next strip, as in the reference.
class StripPromoCarousel extends StatefulWidget {
  const StripPromoCarousel({super.key, required this.strips, this.onTap});

  final List<StripPromo> strips;
  final ValueChanged<StripPromo>? onTap;

  @override
  State<StripPromoCarousel> createState() => _StripPromoCarouselState();
}

class _StripPromoCarouselState extends State<StripPromoCarousel> {
  late final PageController _controller =
      PageController(viewportFraction: 0.94);
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_controller.hasClients) return;
      _page = (_page + 1) % widget.strips.length;
      _controller.animateToPage(
        _page,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
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
    return SizedBox(
      height: AppSizes.stripBannerHeight,
      child: PageView.builder(
        controller: _controller,
        itemCount: widget.strips.length,
        onPageChanged: (i) => _page = i,
        itemBuilder: (context, index) {
          final strip = widget.strips[index];
          return Padding(
            padding: const EdgeInsets.only(left: AppSpacing.gutter, right: 4),
            child: GestureDetector(
              onTap: () => widget.onTap?.call(strip),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: strip.gradient,
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        strip.headline,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.meta.copyWith(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    if (strip.code != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(AppRadius.xs),
                        ),
                        child: Text(
                          'CODE: ${strip.code}',
                          style: AppTypography.meta.copyWith(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// The large hero carousel. Peeks the next banner, auto-advances and shows the
/// dot indicator used in the reference.
class HeroBannerCarousel extends StatefulWidget {
  const HeroBannerCarousel({
    super.key,
    required this.banners,
    this.onTap,
    this.showIndicator = true,
    this.autoPlay = true,
  });

  final List<PromoBanner> banners;
  final ValueChanged<PromoBanner>? onTap;
  final bool showIndicator;
  final bool autoPlay;

  @override
  State<HeroBannerCarousel> createState() => _HeroBannerCarouselState();
}

class _HeroBannerCarouselState extends State<HeroBannerCarousel> {
  late final PageController _controller =
      PageController(viewportFraction: 0.925);
  Timer? _timer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    if (widget.autoPlay) {
      _timer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (!mounted || !_controller.hasClients) return;
        final next = (_page + 1) % widget.banners.length;
        _controller.animateToPage(
          next,
          duration: const Duration(milliseconds: 520),
          curve: Curves.easeOutCubic,
        );
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final height = (width - AppSpacing.gutter * 2) / AppSizes.heroBannerRatio;

    return Column(
      children: [
        SizedBox(
          height: height,
          child: PageView.builder(
            controller: _controller,
            itemCount: widget.banners.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (context, index) {
              final banner = widget.banners[index];
              return Padding(
                padding: EdgeInsets.only(
                  left: index == 0 ? AppSpacing.gutter : 5,
                  right: 5,
                ),
                child: HeroBannerCard(
                  banner: banner,
                  onTap: () => widget.onTap?.call(banner),
                ),
              );
            },
          ),
        ),
        if (widget.showIndicator && widget.banners.length > 1) ...[
          const SizedBox(height: 10),
          _DotIndicator(count: widget.banners.length, index: _page),
        ],
      ],
    );
  }
}

class HeroBannerCard extends StatelessWidget {
  const HeroBannerCard({super.key, required this.banner, this.onTap});

  final PromoBanner banner;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final fg = banner.foreground;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: AppRadius.banner,
          gradient: LinearGradient(
            colors: banner.gradient,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Stack(
          children: [
            // A backend banner is the whole artwork — headline included — so it
            // fills the card. The narrow right-hand box is for the older style
            // where the card drew the words and the image was a cut-out beside
            // them; letterboxing a full banner into it left a black gutter.
            if (banner.image != null)
              if (banner.title.isEmpty)
                Positioned.fill(
                  child: AppImage(banner.image, fit: BoxFit.cover),
                )
              else
                Positioned(
                  right: -8,
                  top: 0,
                  bottom: 0,
                  width: 170,
                  child: AppImage(
                    banner.image,
                    fit: BoxFit.contain,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 150, 14),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (banner.eyebrow != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: fg.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(AppRadius.xs),
                      ),
                      child: Text(
                        banner.eyebrow!,
                        style: AppTypography.badge
                            .copyWith(color: fg, fontSize: 10.5),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  Flexible(
                    child: Text(
                      banner.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.sectionTitle.copyWith(
                        fontSize: 22,
                        height: 1.05,
                        letterSpacing: -0.4,
                        color: fg,
                      ),
                    ),
                  ),
                  if (banner.subtitle != null) ...[
                    const SizedBox(height: 6),
                    Flexible(
                      child: Text(
                        banner.subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.metaMuted.copyWith(
                          color: fg.withValues(alpha: 0.88),
                          fontSize: 12.5,
                        ),
                      ),
                    ),
                  ],
                  if (banner.ctaLabel != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: AppColors.brandBlack,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Text(
                        banner.ctaLabel!,
                        style: AppTypography.badge.copyWith(fontSize: 11),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (banner.savingBadge != null)
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  width: 70,
                  height: 70,
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.all(6),
                  child: Text(
                    banner.savingBadge!,
                    textAlign: TextAlign.center,
                    style: AppTypography.badge.copyWith(
                      color: AppColors.textPrimary,
                      fontSize: 9,
                      height: 1.15,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DotIndicator extends StatelessWidget {
  const _DotIndicator({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final active = i == index;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 18 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: active ? AppColors.textPrimary : AppColors.textTertiary,
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
        );
      }),
    );
  }
}

/// Card in the "Offers for you" carousel.
class OfferCardView extends StatelessWidget {
  const OfferCardView({super.key, required this.offer, this.onTap});

  final OfferCard offer;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 210,
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
        decoration: BoxDecoration(
          color: offer.canvas,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: Colors.white, width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            if (offer.icon != null)
              Icon(offer.icon, size: 30, color: AppColors.textPrimary)
            else
              Image.asset(
                'assets/images/d2k_wordmark.png',
                height: 18,
                fit: BoxFit.contain,
              ),
            const SizedBox(height: 8),
            Text(
              offer.headline,
              textAlign: TextAlign.center,
              style: AppTypography.sectionTitleSmall.copyWith(height: 1.2),
            ),
            if (offer.subline != null) ...[
              const SizedBox(height: 3),
              Text(
                offer.subline!,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.metaMuted.copyWith(fontSize: 12),
              ),
            ],
            const SizedBox(height: 8),
            if (offer.code != null)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.brandBlack,
                  borderRadius: BorderRadius.circular(AppRadius.xs),
                ),
                child: Text.rich(
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Code: '),
                      TextSpan(
                        text: offer.code!,
                        style: const TextStyle(color: AppColors.brandYellow),
                      ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.badge.copyWith(fontSize: 11.5),
                ),
              ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Shop Now', style: AppTypography.buttonSmall),
                const Icon(Icons.chevron_right, size: 16),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
