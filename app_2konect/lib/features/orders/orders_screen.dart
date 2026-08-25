import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../models/order.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';
import 'widgets/status_chips.dart';

/// Everything the customer has bought, and exactly where it is.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final orders = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('orders.yourOrders')),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: K.brand300,
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          tabs: [
            Tab(text: ref.t('orders.tabAll')),
            Tab(text: ref.t('orders.tabActive')),
            Tab(text: ref.t('orders.tabCompleted')),
          ],
        ),
      ),
      body: orders.when(
        loading: () => const Loading(),
        error: (error, _) =>
            ErrorState(error: error, onRetry: () => ref.invalidate(ordersProvider)),
        data: (all) => TabBarView(
          controller: _tabs,
          children: [
            _OrderList(orders: all, emptyKey: 'orders.empty'),
            _OrderList(
              orders: all.where(_isActive).toList(),
              emptyKey: 'orders.noActiveOrders',
            ),
            _OrderList(
              orders: all.where((o) => !_isActive(o)).toList(),
              emptyKey: 'orders.noCompletedOrders',
            ),
          ],
        ),
      ),
    );
  }

  static bool _isActive(Order order) =>
      order.status != 'completed' && order.status != 'cancelled';
}

class _OrderList extends ConsumerWidget {
  const _OrderList({required this.orders, required this.emptyKey});

  final List<Order> orders;
  final String emptyKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (orders.isEmpty) {
      return EmptyState(
        icon: Icons.inventory_2_outlined,
        title: ref.t(emptyKey),
        message: ref.t('orders.emptyAllHint'),
        actionLabel: ref.t('orders.startShopping'),
        onAction: () => context.go('/shop'),
      );
    }

    return RefreshIndicator(
      color: K.brand,
      onRefresh: () async => ref.refresh(ordersProvider.future),
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(K.s14, K.s14, K.s14, K.s24),
        itemCount: orders.length,
        separatorBuilder: (_, _) => const SizedBox(height: K.s10),
        itemBuilder: (context, index) => OrderCard(order: orders[index]),
      ),
    );
  }
}

/// One order, summarised — with all three status axes visible at once.
class OrderCard extends ConsumerWidget {
  const OrderCard({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      onTap: () => context.push('/orders/${order.reference}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  ref.t('orders.referenceLabel', {'reference': order.reference}),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                Money.format(order.total, order.currency),
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: K.brand),
              ),
            ],
          ),
          const SizedBox(height: K.s2),
          Text(
            order.itemCount == 1
                ? ref.t('orders.placedItemOne', {'date': Dates.medium(order.placedAt)})
                : ref.t('orders.placedItems', {
                    'date': Dates.medium(order.placedAt),
                    'count': order.itemCount,
                  }),
            style: KType.meta,
          ),
          const SizedBox(height: K.s12),

          if (order.items.isNotEmpty)
            SizedBox(
              height: 48,
              child: Row(
                children: [
                  for (final item in order.items.take(4))
                    Container(
                      width: 48,
                      height: 48,
                      margin: const EdgeInsets.only(right: K.s8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: K.radius(K.rSm),
                        border: K.hairline,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: ProductImage(
                        url: item.productImage,
                        padding: const EdgeInsets.all(K.s4),
                        decodeWidth: 110,
                      ),
                    ),
                  if (order.items.length > 4)
                    Text(
                      ref.t('orders.moreItems', {'count': order.items.length - 4}),
                      style: KType.meta,
                    ),
                ],
              ),
            ),

          const SizedBox(height: K.s12),
          Wrap(
            spacing: K.s6,
            runSpacing: K.s6,
            children: [
              OrderStatusChip(order: order),
              PaymentStatusChip(status: order.paymentStatus),
              if (order.isImport) DeliveryStatusChip(request: order.deliveryRequest),
            ],
          ),

          // Money outstanding is the one thing worth a button on a summary row.
          if (order.awaitsPayment) ...[
            const SizedBox(height: K.s12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => context.push('/pay/${order.reference}'),
                style: FilledButton.styleFrom(minimumSize: const Size(0, 42)),
                child: Text(ref.t('payment.iHavePaid')),
              ),
            ),
          ] else if (order.canRequestDelivery && order.deliveryRequest == null) ...[
            const SizedBox(height: K.s12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => context.push('/deliveries/new/${order.reference}'),
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42)),
                child: Text(ref.t('orders.arrangeDelivery')),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
