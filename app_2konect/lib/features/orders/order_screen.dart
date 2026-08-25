import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/order.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';
import 'widgets/status_chips.dart';
import 'widgets/timeline.dart';

/// One order, in full.
///
/// The screen is organised around the three questions a customer actually has,
/// each answered separately because they are separate:
///
///   * **Where is my order?** — the journey, from receipt through customs to
///     the door.
///   * **What about the money?** — its own panel, its own status, its own
///     action.
///   * **How does it reach me?** — delivery, arranged after an import lands
///     rather than assumed at checkout.
class OrderScreen extends ConsumerWidget {
  const OrderScreen({super.key, required this.reference});

  final String reference;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(orderProvider(reference));

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('orders.referenceLabel', {'reference': reference})),
      ),
      body: order.when(
        loading: () => const Loading(),
        error: (error, _) {
          final failure = error is ApiException ? error : ApiException.from(error);
          if (failure.failure == ApiFailure.notFound) {
            return EmptyState(
              icon: Icons.search_off_rounded,
              title: ref.t('orders.notFound'),
              message: ref.t('orders.notFoundHint', {'reference': reference}),
              actionLabel: ref.t('orders.yourOrders'),
              onAction: () => context.go('/orders'),
            );
          }
          return ErrorState(
            error: error,
            onRetry: () => ref.invalidate(orderProvider(reference)),
          );
        },
        data: (data) => RefreshIndicator(
          color: K.brand,
          onRefresh: () async => ref.refresh(orderProvider(reference).future),
          child: _Body(order: data),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        /* ---- 1. where is the order ---- */
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      order.statusLabel,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  Tag(
                    order.isImport ? ref.t('orders.tagImport') : ref.t('orders.tagLocal'),
                    tone: order.isImport ? Tone.import : Tone.local,
                  ),
                ],
              ),
              const SizedBox(height: K.s4),
              Text(
                ref.t('orders.placedOn', {'date': Dates.medium(order.placedAt)}),
                style: const TextStyle(fontSize: 12, color: K.inkFaint),
              ),
              if (order.fulfilment.eta != null) ...[
                const SizedBox(height: K.s10),
                Row(
                  children: [
                    const Icon(Icons.schedule_rounded, size: 14, color: K.inkMuted),
                    const SizedBox(width: K.s6),
                    Text(
                      '${ref.t('orders.estimatedArrival')}: ${order.fulfilment.eta!.label}',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: K.inkSoft,
                      ),
                    ),
                  ],
                ),
              ],
              if (order.fulfilment.trackingNumber != null) ...[
                const SizedBox(height: K.s6),
                Row(
                  children: [
                    const Icon(Icons.local_shipping_outlined, size: 14, color: K.inkMuted),
                    const SizedBox(width: K.s6),
                    Expanded(
                      child: Text(
                        [
                          order.fulfilment.carrier,
                          order.fulfilment.trackingNumber,
                        ].whereType<String>().join(' · '),
                        style: const TextStyle(fontSize: 12.5, color: K.inkSoft),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),

        if (order.timeline.isNotEmpty) ...[
          const SizedBox(height: K.s12),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ref.t('orders.journey'), style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: K.s14),
                OrderTimeline(steps: order.timeline),
              ],
            ),
          ),
        ],

        /* ---- 2. the money ---- */
        const SizedBox(height: K.s12),
        _PaymentPanel(order: order),

        /* ---- 3. how it reaches you ---- */
        const SizedBox(height: K.s12),
        _DeliveryPanel(order: order),

        /* ---- what was bought ---- */
        const SizedBox(height: K.s12),
        _ItemsPanel(order: order),

        const SizedBox(height: K.s12),
        _TotalsPanel(order: order),

        if (order.canCancel) ...[
          const SizedBox(height: K.gutter),
          OutlinedButton(
            onPressed: () => _cancel(context, ref),
            style: OutlinedButton.styleFrom(
              foregroundColor: K.danger,
              side: const BorderSide(color: K.danger),
            ),
            child: Text(ref.t('orders.cancel')),
          ),
        ],
      ],
    );
  }

  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(ref.read(tProvider)('orders.cancelConfirm')),
        content: Text(ref.read(tProvider)('orders.cancelConfirmHint')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(ref.read(tProvider)('orders.keepOrder')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: K.danger),
            child: Text(ref.read(tProvider)('orders.cancel')),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(commerceServiceProvider).cancelOrder(order.reference);
      ref.invalidate(orderProvider(order.reference));
      ref.invalidate(ordersProvider);
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }
}

/// The money. Its own panel, because payment status is not order status.
class _PaymentPanel extends ConsumerWidget {
  const _PaymentPanel({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  ref.t('checkout.payment'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              PaymentStatusChip(status: order.paymentStatus),
            ],
          ),
          if (order.paymentReference != null) ...[
            const SizedBox(height: K.s10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    ref.t('payment.paymentReference'),
                    style: const TextStyle(fontSize: 12, color: K.inkMuted),
                  ),
                ),
                Text(
                  order.paymentReference!,
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ],
          if (order.paymentNote != null) ...[
            const SizedBox(height: K.s8),
            Text(
              order.paymentNote!,
              style: const TextStyle(fontSize: 12, height: 1.5, color: K.inkMuted),
            ),
          ],
          if (order.awaitsPayment) ...[
            const SizedBox(height: K.s12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => context.push('/pay/${order.reference}'),
                child: Text(ref.t('payment.iHavePaid')),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Delivery — separate from payment, and separate from the order itself.
class _DeliveryPanel extends ConsumerWidget {
  const _DeliveryPanel({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final request = order.deliveryRequest;

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  ref.t('orders.delivery'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              DeliveryStatusChip(request: request),
            ],
          ),
          const SizedBox(height: K.s10),

          if (request == null) ...[
            Text(
              order.canRequestDelivery
                  ? ref.t('orders.chooseHow', {'brand': Brand.name})
                  : ref.t('payment.deliveryNotIncluded', {'country': Brand.country}),
              style: const TextStyle(fontSize: 12.5, height: 1.5, color: K.inkMuted),
            ),
            if (order.canRequestDelivery) ...[
              const SizedBox(height: K.s12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => context.push('/deliveries/new/${order.reference}'),
                  child: Text(ref.t('orders.arrangeDeliveryBtn')),
                ),
              ),
            ],
          ] else ...[
            _Row(
              label: ref.t('delivery.howDoYouWantIt'),
              value: request.mode == DeliveryMode.pickup
                  ? ref.t('delivery.collectFrom')
                  : ref.t('delivery.arrangeDelivery'),
            ),
            if (request.address != null)
              _Row(label: ref.t('orders.address'), value: request.address!),
            if (request.pickupPoint != null)
              _Row(label: ref.t('delivery.collectFrom'), value: request.pickupPoint!),
            if (request.preferredWindow != null)
              _Row(label: ref.t('delivery.time'), value: request.preferredWindow!),
            _Row(
              label: ref.t('payment.deliveryFee'),
              // The fee the backend attached, never one invented here. Zero
              // means it has not been priced yet, not that it is free.
              value: request.fee > 0
                  ? Money.format(request.fee, order.currency)
                  : ref.t('payment.deliveryPending'),
            ),
            if (request.courierName != null)
              _Row(
                label: ref.t('orders.rider'),
                value: [request.courierName, request.courierPhone]
                    .whereType<String>()
                    .join(' · '),
              ),
          ],

          if (order.deliveryAddress != null) ...[
            const SizedBox(height: K.s10),
            const Divider(height: 1),
            const SizedBox(height: K.s10),
            _Row(label: ref.t('checkout.deliveryAddress'), value: order.deliveryAddress!),
            if (order.customerPhone != null)
              _Row(label: ref.t('checkout.phone'), value: order.customerPhone!),
          ],
        ],
      ),
    );
  }
}

class _ItemsPanel extends ConsumerWidget {
  const _ItemsPanel({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ref.t('checkout.yourItems', {'count': order.items.length}),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: K.s12),
          for (final item in order.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 11),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  GestureDetector(
                    onTap: item.productId == null
                        ? null
                        : () => context.push('/product/${item.productId}'),
                    child: Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: K.radius(K.rXs),
                        border: K.hairline,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: ProductImage(
                        url: item.productImage,
                        padding: const EdgeInsets.all(4),
                        decodeWidth: 110,
                      ),
                    ),
                  ),
                  const SizedBox(width: K.s10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.productName ?? '—',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            height: 1.35,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (item.options.isNotEmpty)
                          Text(
                            item.options.map((o) => '${o.attribute}: ${o.value}').join(' · '),
                            style: const TextStyle(fontSize: 11, color: K.inkMuted),
                          ),
                        const SizedBox(height: K.s4),
                        Row(
                          children: [
                            Text(
                              ref.t('checkout.qty', {'count': item.quantity}),
                              style: const TextStyle(fontSize: 11.5, color: K.inkFaint),
                            ),
                            const SizedBox(width: K.s8),
                            Tag(
                              item.sourcing.label,
                              tone: item.sourcing.isLocal ? Tone.local : Tone.import,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: K.s8),
                  Text(
                    Money.format(item.total, order.currency),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _TotalsPanel extends ConsumerWidget {
  const _TotalsPanel({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Column(
        children: [
          _Row(
            label: ref.t('orders.subtotal'),
            value: Money.format(order.subtotal, order.currency),
          ),
          _Row(
            label: ref.t('payment.deliveryFee'),
            // A zero fee on an import means "not priced yet", which is a very
            // different statement from "free".
            value: order.deliveryFee > 0
                ? Money.format(order.deliveryFee, order.currency)
                : (order.isImport
                    ? ref.t('payment.deliveryNotAdded')
                    : Money.format(0, order.currency)),
          ),
          const Divider(height: 18),
          Row(
            children: [
              Expanded(
                child: Text(
                  ref.t('orders.total'),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                Money.format(order.total, order.currency),
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: K.brand),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(label, style: const TextStyle(fontSize: 12, color: K.inkMuted)),
          ),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: K.ink),
            ),
          ),
        ],
      ),
    );
  }
}
