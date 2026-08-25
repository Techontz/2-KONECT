import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/order.dart';
import '../../../models/payment.dart';
import '../../../providers/language.dart';
import '../../../widgets/primitives.dart';

/// Order status, payment status and delivery status — three separate facts,
/// rendered as three separate chips.
///
/// They are never merged. An order can be "processing" while its payment is
/// "awaiting verification" and its delivery has not been arranged at all, and
/// a customer who is told only one of those learns the wrong thing.

/// Where the *order* is.
class OrderStatusChip extends StatelessWidget {
  const OrderStatusChip({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final tone = switch (order.status) {
      'completed' || 'delivered' => Tone.success,
      'cancelled' => Tone.danger,
      'shipped' || 'in_transit' || 'dispatched' => Tone.import,
      _ => Tone.brand,
    };
    return Tag(order.statusLabel, tone: tone);
  }
}

/// Whether the money arrived.
class PaymentStatusChip extends ConsumerWidget {
  const PaymentStatusChip({super.key, required this.status});

  final PaymentStatus status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (label, tone, icon) = switch (status) {
      PaymentStatus.notRequired => (
          ref.t('payment.statusOnDelivery'),
          Tone.neutral,
          Icons.payments_outlined,
        ),
      PaymentStatus.awaitingPayment => (
          ref.t('payment.statusAwaitingPayment'),
          Tone.warn,
          Icons.schedule_rounded,
        ),
      PaymentStatus.awaitingVerification => (
          ref.t('payment.statusPendingVerification'),
          Tone.import,
          Icons.hourglass_top_rounded,
        ),
      PaymentStatus.verified => (
          ref.t('payment.statusVerified'),
          Tone.success,
          Icons.verified_rounded,
        ),
      PaymentStatus.rejected => (
          ref.t('payment.statusRejected'),
          Tone.danger,
          Icons.error_outline_rounded,
        ),
    };

    return Tag(label, tone: tone, icon: icon);
  }
}

/// Where the last mile stands — including "not arranged yet", which for a
/// landed import is the normal state rather than a problem.
class DeliveryStatusChip extends ConsumerWidget {
  const DeliveryStatusChip({super.key, required this.request});

  final DeliveryRequest? request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final value = request;

    if (value == null) {
      return Tag(
        ref.t('payment.deliveryNotAdded'),
        icon: Icons.local_shipping_outlined,
      );
    }

    final tone = switch (value.status) {
      'delivered' || 'collected' || 'completed' => Tone.success,
      'cancelled' => Tone.danger,
      'assigned' || 'out_for_delivery' || 'in_transit' => Tone.import,
      _ => Tone.brand,
    };

    return Tag(
      value.statusLabel,
      tone: tone,
      icon: value.mode == DeliveryMode.pickup
          ? Icons.store_mall_directory_outlined
          : Icons.local_shipping_outlined,
    );
  }
}
