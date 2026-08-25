import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/seller.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// The seller's order book, and the one action they own: moving a line along.
///
/// A seller may mark their own line prepared, shipped or cancelled. They can
/// never mark a payment verified — that is an administrator's decision, made
/// in the admin panel, and no route in this app can reach it.
class SellerOrdersScreen extends ConsumerWidget {
  const SellerOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(sellerOrdersProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('seller.orders'))),
      body: orders.when(
        loading: () => const Loading(),
        error: (error, _) =>
            ErrorState(error: error, onRetry: () => ref.invalidate(sellerOrdersProvider)),
        data: (data) => data.isEmpty
            ? EmptyState(
                icon: Icons.receipt_long_outlined,
                title: ref.t('seller.noOrdersHere'),
                message: ref.t('seller.noOrdersHint'),
              )
            : RefreshIndicator(
                color: K.brand,
                onRefresh: () async => ref.refresh(sellerOrdersProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                  itemCount: data.length,
                  separatorBuilder: (_, _) => const SizedBox(height: K.s10),
                  itemBuilder: (context, index) => _OrderLine(line: data[index]),
                ),
              ),
      ),
    );
  }
}

class _OrderLine extends ConsumerWidget {
  const _OrderLine({required this.line});

  final SellerOrderLine line;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: K.radius(K.rXs),
                  border: K.hairline,
                ),
                clipBehavior: Clip.antiAlias,
                child: ProductImage(
                  url: line.productImage,
                  padding: const EdgeInsets.all(4),
                  decodeWidth: 100,
                ),
              ),
              const SizedBox(width: K.s10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      line.productName ?? '—',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: K.s4),
                    Text(
                      [
                        ref.t('orders.referenceLabel', {'reference': line.reference}),
                        ref.t('checkout.qty', {'count': line.quantity}),
                        if (line.placedAt != null) Dates.medium(line.placedAt),
                      ].join(' · '),
                      style: const TextStyle(fontSize: 11, color: K.inkFaint),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: K.s8),
              Text(
                Money.format(line.total),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: K.s10),
          Row(
            children: [
              Tag(line.statusLabel, tone: _tone(line.status)),
              const SizedBox(width: K.s6),
              Tag(
                line.isImport ? ref.t('orders.tagImport') : ref.t('orders.tagLocal'),
                tone: line.isImport ? Tone.import : Tone.local,
              ),
              const Spacer(),
              if (line.customerName != null)
                Flexible(
                  child: Text(
                    line.customerName!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: K.inkMuted),
                  ),
                ),
            ],
          ),

          // One button, and it is the server's own next stage. An imported
          // line stops at customs and a local warehouse; a local one does not.
          // Deriving that here would be inventing a journey the backend
          // already owns.
          if (line.isOpen) ...[
            const SizedBox(height: K.s10),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: () => _update(context, ref, line.nextStage!.value),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 38),
                      textStyle:
                          const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                    ),
                    child: Text(
                      line.nextStage!.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                const SizedBox(width: K.s8),
                OutlinedButton(
                  onPressed: () => _cancel(context, ref),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: K.danger,
                    minimumSize: const Size(0, 38),
                    textStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                  ),
                  child: Text(ref.t('common.cancel')),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  static Tone _tone(String status) => switch (status) {
        'completed' || 'delivered' => Tone.success,
        'cancelled' => Tone.danger,
        'shipped' => Tone.import,
        _ => Tone.brand,
      };

  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        content: Text(ref.read(tProvider)('seller.cancelOrderConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(ref.read(tProvider)('common.no')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: K.danger),
            child: Text(ref.read(tProvider)('common.yes')),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await _update(context, ref, 'cancelled');
  }

  Future<void> _update(BuildContext context, WidgetRef ref, String status) async {
    try {
      await ref.read(sellerServiceProvider).updateOrderStatus(line.id, status);
      ref.invalidate(sellerOrdersProvider);
      ref.invalidate(sellerDashboardProvider);
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }
}
