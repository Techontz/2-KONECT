import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/theme/tokens.dart';
import '../providers/cart.dart';
import '../providers/connectivity.dart';
import '../providers/language.dart';
import 'states.dart';

/// The phone navigation bar, and the frame every tab sits in.
///
/// Most of this marketplace's traffic is a thumb on a handset, so the five
/// destinations that matter live permanently within reach of it rather than
/// behind a burger. Every target clears 44px and the bar respects the home
/// indicator inset, so nothing sits under the system gesture area.
///
/// The same five the website's own `MobileTabBar` uses, in the same order:
/// Home, Shop, Cart, Orders, Account.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartCount = ref.watch(cartCountProvider);
    final offline = ref.watch(isOfflineProvider);

    final tabs = <_Tab>[
      _Tab(ref.t('nav.home'), Icons.home_outlined, Icons.home_rounded),
      _Tab(ref.t('nav.shop'), Icons.grid_view_outlined, Icons.grid_view_rounded),
      _Tab(ref.t('nav.cart'), Icons.shopping_cart_outlined, Icons.shopping_cart_rounded,
          badge: cartCount),
      _Tab(ref.t('nav.orders'), Icons.inventory_2_outlined, Icons.inventory_2_rounded),
      _Tab(ref.t('nav.account'), Icons.person_outline_rounded, Icons.person_rounded),
    ];

    return Scaffold(
      body: Column(
        children: [
          if (offline) SafeArea(bottom: false, child: const OfflineBanner()),
          Expanded(child: shell),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: K.surface,
          border: Border(top: BorderSide(color: K.line)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: K.tabBarHeight,
            child: Row(
              children: [
                for (var index = 0; index < tabs.length; index++)
                  Expanded(
                    child: _TabButton(
                      tab: tabs[index],
                      active: shell.currentIndex == index,
                      onTap: () => _go(index),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Tapping the tab you are already on returns to the top of that tab, which
  /// is what every native app does and what a deep stack needs.
  void _go(int index) => shell.goBranch(index, initialLocation: index == shell.currentIndex);
}

class _Tab {
  const _Tab(this.label, this.icon, this.activeIcon, {this.badge = 0});

  final String label;
  final IconData icon;
  final IconData activeIcon;
  final int badge;
}

/// One destination.
///
/// The selected state is carried three ways at once — a filled glyph, the
/// brand navy, and a short rule above it — because colour alone fails for a
/// reader who cannot distinguish it, and a rule alone is easy to miss on a
/// small bar.
class _TabButton extends StatelessWidget {
  const _TabButton({required this.tab, required this.active, required this.onTap});

  final _Tab tab;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colour = active ? K.brand : K.inkMuted;

    return Semantics(
      selected: active,
      button: true,
      label: tab.label,
      child: InkResponse(
        onTap: onTap,
        radius: 44,
        highlightShape: BoxShape.rectangle,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    // The glyph fills when selected rather than only changing
                    // colour, and crossfades so the change is felt without
                    // anything moving.
                    AnimatedSwitcher(
                      duration: K.fast,
                      child: Icon(
                        active ? tab.activeIcon : tab.icon,
                        key: ValueKey(active),
                        size: 22,
                        color: colour,
                      ),
                    ),
                    if (tab.badge > 0)
                      Positioned(
                        right: -9,
                        top: -6,
                        child: _Badge(count: tab.badge),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                AnimatedDefaultTextStyle(
                  duration: K.fast,
                  style: TextStyle(
                    fontFamily: K.fontFamily,
                    fontSize: 10,
                    fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                    color: colour,
                  ),
                  child: Text(tab.label, maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
            // The rule grows out of the centre rather than appearing, which is
            // what makes switching tabs feel like movement rather than a
            // repaint.
            Positioned(
              top: 0,
              child: AnimatedContainer(
                duration: K.normal,
                curve: K.easing,
                width: active ? 26 : 0,
                height: 2,
                decoration: BoxDecoration(
                  color: K.brand,
                  borderRadius: K.radius(K.rPill),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The count on a tab. Scales in when it first appears, so an item landing in
/// the basket is visibly acknowledged from wherever the shopper is.
class _Badge extends StatelessWidget {
  const _Badge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      key: ValueKey(count),
      tween: Tween(begin: 0.7, end: 1),
      duration: K.normal,
      curve: Curves.easeOutBack,
      builder: (context, scale, child) => Transform.scale(scale: scale, child: child),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
        constraints: const BoxConstraints(minWidth: 16),
        decoration: BoxDecoration(
          color: K.brand,
          borderRadius: K.radius(K.rPill),
          border: Border.all(color: K.surface, width: 1.5),
        ),
        child: Text(
          count > 99 ? '99+' : '$count',
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontFamily: K.fontFamily,
            fontSize: 9,
            height: 1.3,
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
