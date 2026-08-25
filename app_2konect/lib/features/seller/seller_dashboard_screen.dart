import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/seller.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/product_card.dart';
import '../../widgets/product_grid.dart';
import '../../widgets/states.dart';

/// The seller console.
///
/// Only what a seller may see and do, scoped to their own store by the server.
/// Administration — approving other sellers, verifying payments, editing the
/// catalogue at large — stays in the admin panel; this app is the customer
/// marketplace plus the seller's own shopfront.
class SellerDashboardScreen extends ConsumerWidget {
  const SellerDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(sellerDashboardProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('seller.dashboard'))),
      body: dashboard.when(
        loading: () => const Loading(),
        error: (error, _) {
          final failure = error is ApiException ? error : ApiException.from(error);
          // A 403 here means the account has no store — an ordinary shopper —
          // rather than a broken session, and the way forward is to apply.
          if (failure.isForbidden) {
            return EmptyState(
              icon: Icons.storefront_outlined,
              title: ref.t('seller.profileNotSetUp'),
              message: ref.t('seller.profileNotSetUpHint'),
              actionLabel: ref.t('sell.applyToSell'),
              onAction: () => context.pushReplacement('/sell'),
            );
          }
          return ErrorState(
            error: error,
            onRetry: () => ref.invalidate(sellerDashboardProvider),
          );
        },
        data: (data) => RefreshIndicator(
          color: K.brand,
          onRefresh: () async => ref.refresh(sellerDashboardProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
            children: [
              _StoreCard(dashboard: data),
              const SizedBox(height: K.s12),
              _Stats(stats: data.stats),
              const SizedBox(height: K.s12),
              Row(
                children: [
                  Expanded(
                    child: _Action(
                      icon: Icons.inventory_2_outlined,
                      label: ref.t('seller.myProducts'),
                      onTap: () => context.push('/seller/products'),
                    ),
                  ),
                  const SizedBox(width: K.s10),
                  Expanded(
                    child: _Action(
                      icon: Icons.receipt_long_outlined,
                      label: ref.t('seller.orders'),
                      onTap: () => context.push('/seller/orders'),
                    ),
                  ),
                  const SizedBox(width: K.s10),
                  Expanded(
                    child: _Action(
                      icon: Icons.verified_outlined,
                      label: ref.t('app.storeAndVerification'),
                      onTap: () => context.push('/seller/store'),
                    ),
                  ),
                ],
              ),
              if (data.lowStockProducts.isNotEmpty) ...[
                const SizedBox(height: K.s20),
                SectionHead(
                  title: ref.t('seller.lowStock'),
                  padding: const EdgeInsets.only(bottom: 10),
                ),
                GridView.builder(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(horizontal: K.s2),
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: ProductGrid.delegate(context),
                  itemCount: data.lowStockProducts.length,
                  itemBuilder: (context, index) =>
                      ProductCard(product: data.lowStockProducts[index]),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StoreCard extends ConsumerWidget {
  const _StoreCard({required this.dashboard});

  final SellerDashboard dashboard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: K.brand50,
              borderRadius: K.radius(K.rSm),
              border: K.hairline,
            ),
            clipBehavior: Clip.antiAlias,
            child: dashboard.logo == null
                ? const Icon(Icons.storefront_rounded, size: 21, color: K.brand400)
                : ProductImage(url: dashboard.logo, decodeWidth: 110),
          ),
          const SizedBox(width: K.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  dashboard.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: K.s4),
                Row(
                  children: [
                    Tag(
                      dashboard.isApproved
                          ? ref.t('seller.approvedToSell')
                          : ref.t('seller.awaitingApproval'),
                      tone: dashboard.isApproved ? Tone.success : Tone.warn,
                    ),
                    if (dashboard.since != null) ...[
                      const SizedBox(width: K.s6),
                      Text(
                        dashboard.since!,
                        style: const TextStyle(fontSize: 11, color: K.inkFaint),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Stats extends ConsumerWidget {
  const _Stats({required this.stats});

  final SellerStats stats;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        Panel(
          color: K.brand,
          border: Border.all(color: K.brand),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      ref.t('app.earnings'),
                      style: const TextStyle(fontSize: 11.5, color: K.brand300),
                    ),
                    const SizedBox(height: K.s4),
                    Text(
                      Money.format(stats.earnings, stats.currency),
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    ref.t('app.paidOut'),
                    style: const TextStyle(fontSize: 11.5, color: K.brand300),
                  ),
                  const SizedBox(height: K.s4),
                  Text(
                    Money.format(stats.paidOut, stats.currency),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: K.s10),
        Row(
          children: [
            Expanded(
              child: _Stat(
                value: '${stats.products}',
                label: ref.t('seller.products'),
              ),
            ),
            const SizedBox(width: K.s10),
            Expanded(
              child: _Stat(
                value: '${stats.orders}',
                label: ref.t('seller.orders'),
                accent: stats.ordersPending > 0 ? K.warn : null,
                note: stats.ordersPending > 0
                    ? '${ref.t('seller.tabNew')}: ${stats.ordersPending}'
                    : null,
              ),
            ),
            const SizedBox(width: K.s10),
            Expanded(
              child: _Stat(
                value: '${stats.lowStock}',
                label: ref.t('seller.lowStock'),
                accent: stats.lowStock > 0 ? K.warn : null,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, this.note, this.accent});

  final String value;
  final String label;
  final String? note;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return Panel(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: accent ?? K.ink,
            ),
          ),
          const SizedBox(height: K.s2),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 10.5, height: 1.3, color: K.inkMuted),
          ),
          if (note != null)
            Text(
              note!,
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: accent),
            ),
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Panel(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 21, color: K.brand),
          const SizedBox(height: K.s8),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
