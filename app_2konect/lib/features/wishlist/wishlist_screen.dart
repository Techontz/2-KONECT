import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/tokens.dart';
import '../../providers/language.dart';
import '../../providers/session.dart';
import '../../providers/wishlist.dart';
import '../../widgets/product_grid.dart';
import '../../widgets/states.dart';

/// Saved items.
///
/// Works signed out — the heart is not a reason to demand an account — and the
/// local list is merged into the account's on the first sign-in, so nothing is
/// lost by browsing first.
class WishlistScreen extends ConsumerWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wishlist = ref.watch(wishlistProvider);
    final signedIn = ref.watch(isSignedInProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('wishlist.title')),
      ),
      body: Builder(
        builder: (context) {
          if (wishlist.loading && wishlist.products.isEmpty) return const Loading();

          if (wishlist.ids.isEmpty) {
            return EmptyState(
              icon: Icons.favorite_border_rounded,
              title: ref.t('wishlist.empty'),
              message: ref.t('wishlist.emptyHint'),
              actionLabel: ref.t('wishlist.browse'),
              onAction: () => context.go('/shop'),
            );
          }

          // Saved as a guest: the ids are known but the products live on the
          // server, so the list can only be rendered once there is an account
          // to read it against.
          if (!signedIn && wishlist.products.isEmpty) {
            return EmptyState(
              icon: Icons.lock_outline_rounded,
              title: ref.t('auth.signInToContinue'),
              message: ref.t('wishlist.itemCount', {'count': wishlist.ids.length}),
              actionLabel: ref.t('auth.login'),
              onAction: () =>
                  context.push('/auth?redirect=${Uri.encodeComponent('/wishlist')}'),
            );
          }

          return RefreshIndicator(
            color: K.brand,
            onRefresh: () => ref.read(wishlistProvider.notifier).refresh(),
            child: ProductGridView(products: wishlist.products),
          );
        },
      ),
    );
  }
}
