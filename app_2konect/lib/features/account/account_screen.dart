import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/brand.dart';
import '../../core/config/env.dart';
import '../../core/theme/tokens.dart';
import '../../models/account.dart';
import '../../providers/cart.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../providers/session.dart';
import '../../providers/wishlist.dart';
import '../../widgets/primitives.dart';

/// The account.
///
/// Everything personal reachable from one place — orders, saved items,
/// addresses, sourcing requests, messages, language — and, for an account that
/// has a store, the seller console. Admin functions are deliberately absent:
/// this is the customer marketplace, and administration stays in the admin
/// panel where it belongs.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final saved = ref.watch(wishlistProvider).ids.length;
    final cartCount = ref.watch(cartCountProvider);
    final unread = ref.watch(unreadMessagesProvider).valueOrNull ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('account.title'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
        children: [
          if (user == null) const _SignedOutCard() else _ProfileCard(user: user),

          const SizedBox(height: K.gutter),
          _Group(
            title: ref.t('account.shopping'),
            tiles: [
              _Tile(
                icon: Icons.inventory_2_outlined,
                label: ref.t('account.myOrders'),
                note: ref.t('account.myOrdersNote'),
                onTap: () => context.go('/orders'),
              ),
              _Tile(
                icon: Icons.favorite_border_rounded,
                label: ref.t('account.savedItems'),
                note: ref.t('account.savedItemsNote'),
                badge: saved,
                onTap: () => context.push('/wishlist'),
              ),
              _Tile(
                icon: Icons.shopping_cart_outlined,
                label: ref.t('account.cart'),
                badge: cartCount,
                onTap: () => context.go('/cart'),
              ),
              _Tile(
                icon: Icons.place_outlined,
                label: ref.t('account.addresses'),
                note: ref.t('account.addressesNote'),
                onTap: () => _requireAccount(context, ref, '/addresses'),
              ),
            ],
          ),

          const SizedBox(height: K.s14),
          _Group(
            title: ref.t('account.sourcing'),
            tiles: [
              _Tile(
                icon: Icons.travel_explore_rounded,
                label: ref.t('account.requestProduct'),
                note: ref.t('account.requestProductNote'),
                onTap: () => context.push('/request'),
              ),
              _Tile(
                icon: Icons.assignment_outlined,
                label: ref.t('account.myRequests'),
                note: ref.t('account.myRequestsNote'),
                onTap: () => _requireAccount(context, ref, '/requests'),
              ),
              _Tile(
                icon: Icons.local_shipping_outlined,
                label: ref.t('account.deliveries'),
                note: ref.t('account.deliveriesNote', {'brand': Brand.name}),
                onTap: () => _requireAccount(context, ref, '/deliveries'),
              ),
              _Tile(
                icon: Icons.chat_bubble_outline_rounded,
                label: ref.t('account.messages'),
                note: ref.t('account.messagesNote'),
                badge: unread,
                onTap: () => _requireAccount(context, ref, '/messages'),
              ),
            ],
          ),

          const SizedBox(height: K.s14),
          _Group(
            title: ref.t('footer.sellers'),
            tiles: [
              if (user?.sellerApproved == true)
                _Tile(
                  icon: Icons.dashboard_outlined,
                  label: ref.t('account.sellerDashboard'),
                  note: ref.t('account.sellerDashboardHint'),
                  onTap: () => context.push('/seller'),
                )
              else
                _Tile(
                  icon: Icons.storefront_outlined,
                  label: ref.t('account.startStore'),
                  note: ref.t('auth.sellHint'),
                  onTap: () => context.push('/sell'),
                ),
            ],
          ),

          const SizedBox(height: K.s14),
          _Group(
            title: ref.t('app.more'),
            tiles: [
              _Tile(
                icon: Icons.language_rounded,
                label: ref.t('language.label'),
                note: ref.watch(languageProvider).language.label,
                onTap: () => context.push('/language'),
              ),
              _Tile(
                icon: Icons.storefront_outlined,
                label: ref.t('footer.ourVendors'),
                onTap: () => context.push('/vendors'),
              ),
              // Help centre, delivery information and the legal pages are the
              // website's, word for word. Opening them rather than copying
              // them keeps one version of the terms in existence.
              _Tile(
                icon: Icons.help_outline_rounded,
                label: ref.t('account.help'),
                note: ref.t('app.openInBrowser'),
                onTap: () => _openWeb('/help/'),
              ),
              _Tile(
                icon: Icons.gavel_rounded,
                label: ref.t('app.helpAndLegal'),
                note: ref.t('account.privacy'),
                onTap: () => _openWeb('/legal/terms/'),
              ),
            ],
          ),

          if (user != null) ...[
            const SizedBox(height: K.s20),
            OutlinedButton.icon(
              onPressed: () => _signOut(context, ref),
              icon: const Icon(Icons.logout_rounded, size: 17),
              label: Text(ref.t('account.logout')),
              style: OutlinedButton.styleFrom(
                foregroundColor: K.danger,
                side: const BorderSide(color: K.lineStrong),
              ),
            ),
          ],

          const SizedBox(height: K.s20),
          Center(
            child: Text(
              '${Brand.name} · ${Brand.tagline}',
              style: const TextStyle(fontSize: 11, color: K.inkFaint),
            ),
          ),
        ],
      ),
    );
  }

  static Future<void> _openWeb(String path) async {
    final uri = Uri.parse('${Env.siteUrl}$path');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  /// A protected destination reached signed out sends the customer through
  /// sign-in and back again, rather than refusing.
  static void _requireAccount(BuildContext context, WidgetRef ref, String path) {
    if (ref.read(isSignedInProvider)) {
      context.push(path);
    } else {
      context.push('/auth?redirect=${Uri.encodeComponent(path)}');
    }
  }

  static Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(ref.read(tProvider)('account.logout')),
        content: Text(ref.read(tProvider)('app.signOutConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(ref.read(tProvider)('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: K.danger),
            child: Text(ref.read(tProvider)('account.logout')),
          ),
        ],
      ),
    );

    if (confirmed == true) await ref.read(sessionProvider.notifier).logout();
  }
}

class _SignedOutCard extends ConsumerWidget {
  const _SignedOutCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      color: K.brand,
      border: Border.all(color: K.brand),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ref.t('account.signInTitle'),
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: K.s6),
          Text(
            ref.t('account.signInHint'),
            style: const TextStyle(fontSize: 12.5, height: 1.5, color: K.brand300),
          ),
          const SizedBox(height: K.s14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => context.push('/auth'),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: K.brand,
              ),
              child: Text(ref.t('account.signInAction')),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileCard extends ConsumerWidget {
  const _ProfileCard({required this.user});

  final AuthUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: const BoxDecoration(color: K.brand, shape: BoxShape.circle),
            clipBehavior: Clip.antiAlias,
            child: user.avatarUrl == null
                ? Center(
                    child: Text(
                      user.initials,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  )
                : ProductImage(url: user.avatarUrl, fit: BoxFit.cover, decodeWidth: 110),
          ),
          const SizedBox(width: K.s14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        user.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800),
                      ),
                    ),
                    if (user.vendor?.isApproved == true) ...[
                      const SizedBox(width: K.s6),
                      const VerifiedBadge(size: 14),
                    ],
                  ],
                ),
                const SizedBox(height: K.s2),
                Text(
                  user.email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12, color: K.inkFaint),
                ),
                if (user.vendor != null) ...[
                  const SizedBox(height: K.s6),
                  Tag(user.vendor!.businessName, tone: Tone.brand, icon: Icons.storefront_rounded),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.tiles});

  final String title;
  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
              color: K.inkFaint,
            ),
          ),
        ),
        Panel(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < tiles.length; i++) ...[
                tiles[i],
                if (i != tiles.length - 1)
                  const Padding(
                    padding: EdgeInsets.only(left: 50),
                    child: Divider(height: 1),
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.note,
    this.badge = 0,
  });

  final IconData icon;
  final String label;
  final String? note;
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 13, 12, 13),
        child: Row(
          children: [
            Icon(icon, size: 20, color: K.brand),
            const SizedBox(width: K.s14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                  ),
                  if (note != null && note!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Text(
                        note!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11.5, color: K.inkFaint),
                      ),
                    ),
                ],
              ),
            ),
            if (badge > 0)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: K.brand100,
                  borderRadius: K.radius(K.rPill),
                ),
                child: Text(
                  badge > 99 ? '99+' : '$badge',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: K.brand,
                  ),
                ),
              ),
            const Icon(Icons.chevron_right_rounded, size: 19, color: K.inkFaint),
          ],
        ),
      ),
    );
  }
}
