import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/format.dart';
import '../../core/theme/tokens.dart';
import '../../models/order.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';
import '../orders/widgets/status_chips.dart';

/// Every last-mile job the customer has arranged.
///
/// Its own screen, because delivery has its own lifecycle: an order can be
/// paid and landed with no delivery yet arranged, and a delivery can be out
/// for the door while the order is still shown as processing.
class DeliveriesScreen extends ConsumerWidget {
  const DeliveriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deliveries = ref.watch(deliveriesProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('account.deliveries'))),
      body: deliveries.when(
        loading: () => const Loading(),
        error: (error, _) =>
            ErrorState(error: error, onRetry: () => ref.invalidate(deliveriesProvider)),
        data: (data) => data.isEmpty
            ? EmptyState(
                icon: Icons.local_shipping_outlined,
                title: ref.t('deliveries.empty'),
                message: ref.t('deliveries.emptyHint', {'country': Brand.country}),
                actionLabel: ref.t('orders.yourOrders'),
                onAction: () => context.go('/orders'),
              )
            : RefreshIndicator(
                color: K.brand,
                onRefresh: () async => ref.refresh(deliveriesProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                  itemCount: data.length,
                  separatorBuilder: (_, _) => const SizedBox(height: K.s10),
                  itemBuilder: (context, index) => _DeliveryCard(request: data[index]),
                ),
              ),
      ),
    );
  }
}

class _DeliveryCard extends ConsumerWidget {
  const _DeliveryCard({required this.request});

  final DeliveryRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      onTap: request.orderReference == null
          ? null
          : () => context.push('/orders/${request.orderReference}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  request.reference,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                ),
              ),
              DeliveryStatusChip(request: request),
            ],
          ),
          if (request.orderReference != null) ...[
            const SizedBox(height: K.s4),
            Text(
              ref.t('orders.referenceLabel', {'reference': request.orderReference}),
              style: const TextStyle(fontSize: 11.5, color: K.inkFaint),
            ),
          ],
          const SizedBox(height: K.s10),
          Text(
            request.mode == DeliveryMode.pickup
                ? (request.pickupPoint ?? ref.t('delivery.collectFrom'))
                : (request.address ?? ref.t('delivery.deliveryAddress')),
            style: const TextStyle(fontSize: 12.5, height: 1.45, color: K.inkMuted),
          ),
          if (request.preferredWindow != null) ...[
            const SizedBox(height: K.s4),
            Text(
              request.preferredWindow!,
              style: const TextStyle(fontSize: 11.5, color: K.inkFaint),
            ),
          ],
          const SizedBox(height: K.s10),
          Row(
            children: [
              Expanded(
                child: Text(
                  ref.t('delivery.deliveryFee'),
                  style: const TextStyle(fontSize: 12, color: K.inkMuted),
                ),
              ),
              Text(
                request.fee > 0
                    ? Money.format(request.fee)
                    : ref.t('payment.deliveryPending'),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          if (request.courierName != null) ...[
            const SizedBox(height: K.s6),
            Row(
              children: [
                const Icon(Icons.person_outline_rounded, size: 14, color: K.inkMuted),
                const SizedBox(width: K.s6),
                Expanded(
                  child: Text(
                    [request.courierName, request.courierPhone]
                        .whereType<String>()
                        .join(' · '),
                    style: const TextStyle(fontSize: 12, color: K.inkSoft),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
