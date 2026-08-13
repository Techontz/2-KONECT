import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/l10n/app_strings.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';
import '../state/cart_controller.dart';

class NavDestination {
  const NavDestination({
    required this.label,
    required this.icon,
    required this.activeIcon,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;
}

/// The five-tab bar from the reference: outlined glyph over a label, the active
/// tab tinted blue (icon + label), a white bar with a hairline top edge and the
/// cart badge on the last tab.
class D2KBottomNav extends StatelessWidget {
  const D2KBottomNav({
    super.key,
    required this.index,
    required this.onSelect,
  });

  final int index;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final destinations = <NavDestination>[
      NavDestination(
        label: strings.home,
        icon: Icons.home_outlined,
        activeIcon: Icons.home,
      ),
      NavDestination(
        label: strings.categories,
        icon: Icons.grid_view_outlined,
        activeIcon: Icons.grid_view_rounded,
      ),
      NavDestination(
        label: strings.deals,
        icon: Icons.local_offer_outlined,
        activeIcon: Icons.local_offer,
      ),
      NavDestination(
        label: strings.account,
        icon: Icons.account_circle_outlined,
        activeIcon: Icons.account_circle,
      ),
      NavDestination(
        label: strings.cart,
        icon: Icons.shopping_cart_outlined,
        activeIcon: Icons.shopping_cart,
      ),
    ];

    final cartCount = context.select<CartController, int>((c) => c.itemCount);

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.divider)),
        boxShadow: AppShadows.navBar,
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: AppSizes.navBarHeight,
          child: Row(
            children: [
              for (var i = 0; i < destinations.length; i++)
                Expanded(
                  child: _NavItem(
                    destination: destinations[i],
                    selected: i == index,
                    badgeCount: i == 4 ? cartCount : 0,
                    onTap: () => onSelect(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.destination,
    required this.selected,
    required this.onTap,
    this.badgeCount = 0,
  });

  final NavDestination destination;
  final bool selected;
  final VoidCallback onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppColors.primary : AppColors.textPrimary;
    return InkWell(
      onTap: onTap,
      splashColor: AppColors.primarySoft,
      highlightColor: Colors.transparent,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            height: 26,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedScale(
                  duration: const Duration(milliseconds: 180),
                  scale: selected ? 1.06 : 1,
                  child: Icon(
                    selected ? destination.activeIcon : destination.icon,
                    size: 25,
                    color: color,
                  ),
                ),
                if (badgeCount > 0)
                  Positioned(
                    right: -8,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 5, vertical: 1.5),
                      constraints: const BoxConstraints(minWidth: 18),
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        border: Border.all(color: AppColors.surface, width: 1.5),
                      ),
                      child: Text(
                        badgeCount > 99 ? '99+' : '$badgeCount',
                        textAlign: TextAlign.center,
                        style: AppTypography.badge.copyWith(fontSize: 10),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 2),
          Text(
            destination.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: selected
                ? AppTypography.navLabelActive
                : AppTypography.navLabel,
          ),
        ],
      ),
    );
  }
}
