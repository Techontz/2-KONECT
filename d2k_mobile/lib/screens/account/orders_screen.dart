import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../data/remote_shop_source.dart';
import '../../domain/models/commerce.dart';
import '../../state/auth_controller.dart';
import '../../state/currency_controller.dart';
import '../../widgets/app_image.dart';
import '../../widgets/async_state.dart';

/// The account's real order history, straight from the backend.
///
/// Orders placed on the website appear here and vice versa — there is one
/// order book, not one per client.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  Loadable<List<ShopOrder>> _state = const Loadable.loading();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!context.read<AuthController>().isAuthenticated) {
      setState(() => _state = const Loadable.ready(<ShopOrder>[]));
      return;
    }

    setState(() => _state = const Loadable.loading());
    try {
      final orders = await context.read<RemoteShopSource>().orders();
      if (mounted) setState(() => _state = Loadable.ready(orders));
    } catch (error) {
      if (mounted) setState(() => _state = Loadable.failed(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final signedIn = context.watch<AuthController>().isAuthenticated;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(
        title: Text(strings.orders, style: AppTypography.sectionTitle),
      ),
      body: !signedIn
          ? EmptyState(
              title: strings.signInToContinue,
              message: strings.ordersEmptyBody,
              icon: Icons.lock_outline,
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: LoadableView<List<ShopOrder>>(
                state: _state,
                onRetry: _load,
                isEmpty: (orders) => orders.isEmpty,
                empty: EmptyState(
                  title: strings.ordersEmptyTitle,
                  message: strings.ordersEmptyBody,
                  icon: Icons.receipt_long_outlined,
                ),
                builder: (context, orders) => ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.gutter),
                  itemCount: orders.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) =>
                      _OrderCard(order: orders[index]),
                ),
              ),
            ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});

  final ShopOrder order;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final currency = context.watch<CurrencyController>();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: AppDecorations.flatCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The reference is what a shopper reads out to support, so it gets
          // the full width of the card to itself: sharing a row with the status
          // chip overflowed narrow handsets by ~24pt.
          Text(order.reference, style: AppTypography.bodyStrong),
          const SizedBox(height: 6),
          Row(
            children: [
              _StatusChip(status: order.status),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  DateFormat('d MMM yyyy').format(order.placedAt.toLocal()),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.metaMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (final item in order.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    child: AppImage(
                      item.image,
                      width: 44,
                      height: 44,
                      backgroundColor: AppColors.tileSurface,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.meta,
                        ),
                        if (item.vendorName != null)
                          Text(item.vendorName!, style: AppTypography.metaMuted),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('x${item.quantity}', style: AppTypography.metaMuted),
                ],
              ),
            ),
          const Divider(height: 18),
          Row(
            children: [
              Text(strings.total, style: AppTypography.metaMuted),
              const Spacer(),
              Text(
                currency.format(order.totalMoney),
                style: AppTypography.bodyStrong,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Text(order.paymentLabel, style: AppTypography.metaMuted),
              const Spacer(),
              Flexible(
                child: Text(
                  order.deliveryAddress,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: AppTypography.metaMuted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (status) {
      'completed' => (const Color(0xFFE7F6EA), const Color(0xFF1B7F3B)),
      'cancelled' => (const Color(0xFFFDECEC), const Color(0xFFD3302F)),
      'shipped' => (const Color(0xFFEBF2FF), AppColors.primary),
      _ => (const Color(0xFFFFF4E0), const Color(0xFF9A6400)),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status[0].toUpperCase() + status.substring(1),
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg),
      ),
    );
  }
}
