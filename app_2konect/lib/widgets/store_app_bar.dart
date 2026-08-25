import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/brand.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import '../providers/language.dart';
import '../providers/wishlist.dart';

/// The storefront header: the mark, a search field that opens the search
/// screen, and saved items.
///
/// The navy band is the brand — it is the darkest thing on the screen rather
/// than the loudest, which is what separates a premium commerce surface from a
/// shouty one.
class StoreAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const StoreAppBar({super.key, this.showWishlist = true});

  final bool showWishlist;

  @override
  Size get preferredSize => const Size.fromHeight(100);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(wishlistProvider).ids.length;

    return Container(
      color: K.brand,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(K.gutter, K.s4, K.s6, K.s12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                height: 42,
                child: Row(
                  children: [
                    Semantics(
                      label: ref.t('header.homeAria', {'brand': '2KONECT'}),
                      child: Image.asset(
                        Brand.markWhite,
                        height: 24,
                        fit: BoxFit.contain,
                        // If the asset is ever missing the wordmark still
                        // renders, so the header can never be blank.
                        errorBuilder: (_, _, _) => const Text(
                          Brand.name,
                          style: TextStyle(
                            fontFamily: K.fontFamily,
                            color: Colors.white,
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ),
                    ),
                    const Spacer(),
                    _HeaderAction(
                      icon: Icons.language_rounded,
                      tooltip: ref.t('language.label'),
                      onTap: () => context.push('/language'),
                    ),
                    if (showWishlist)
                      _HeaderAction(
                        icon: Icons.favorite_border_rounded,
                        tooltip: ref.t('header.wishlist'),
                        badge: saved,
                        onTap: () => context.push('/wishlist'),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: K.s6),
              _SearchField(onTap: () => context.push('/search')),
            ],
          ),
        ),
      ),
    );
  }
}

/// A read-only field that opens the real search screen.
///
/// Deliberately not a live input in the header: search on a phone deserves the
/// whole screen — suggestions, recent terms and a keyboard that does not
/// squeeze the results into a strip.
class _SearchField extends ConsumerWidget {
  const _SearchField({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Material(
      color: Colors.white,
      borderRadius: K.radius(K.rSm),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 44,
          child: Row(
            children: [
              const SizedBox(width: K.s12),
              const Icon(Icons.search_rounded, size: 19, color: K.inkMuted),
              const SizedBox(width: K.s10),
              Expanded(
                child: Text(
                  ref.t('header.searchPlaceholder'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: K.fontFamily,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: K.inkFaint,
                  ),
                ),
              ),
              // A quiet camera-less affordance on the right, so the field
              // reads as a control rather than a caption.
              Container(
                margin: const EdgeInsets.symmetric(horizontal: K.s6, vertical: K.s6),
                padding: const EdgeInsets.symmetric(horizontal: K.s10),
                decoration: BoxDecoration(
                  color: K.brand50,
                  borderRadius: K.radius(K.rXs),
                ),
                child: Center(
                  child: Text(
                    ref.t('common.search').toUpperCase(),
                    style: KType.tag.copyWith(color: K.brand),
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

class _HeaderAction extends StatelessWidget {
  const _HeaderAction({
    required this.icon,
    required this.onTap,
    this.tooltip,
    this.badge = 0,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip ?? '',
      child: InkResponse(
        onTap: onTap,
        radius: 24,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              Icon(icon, size: 21, color: Colors.white),
              if (badge > 0)
                Positioned(
                  right: 6,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                    constraints: const BoxConstraints(minWidth: 15),
                    decoration: BoxDecoration(
                      color: K.sale,
                      borderRadius: K.radius(K.rPill),
                      border: Border.all(color: K.brand, width: 1.2),
                    ),
                    child: Text(
                      badge > 99 ? '99+' : '$badge',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 8.5,
                        height: 1.3,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
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
