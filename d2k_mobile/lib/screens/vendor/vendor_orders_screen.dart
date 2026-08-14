import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../state/currency_controller.dart';
import '../../state/vendor_controller.dart';
import '../../widgets/app_image.dart';
import '../../widgets/states.dart';

/// Seller order fulfilment on mobile.
///
/// Status transitions go through the backend, which also restores stock when
/// a line is cancelled — the app never recalculates inventory itself.
class VendorOrdersScreen extends StatefulWidget {
  const VendorOrdersScreen({super.key});

  @override
  State<VendorOrdersScreen> createState() => _VendorOrdersScreenState();
}

class _VendorOrdersScreenState extends State<VendorOrdersScreen> {
  static const _filters = <String, String>{
    '': 'All',
    'pending': 'New',
    'processing': 'Preparing',
    'shipped': 'Shipped',
    'completed': 'Completed',
  };

  String _status = '';
  int? _working;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VendorController>().loadOrders();
    });
  }

  Future<void> _advance(VendorOrderLine order, String status) async {
    setState(() => _working = order.id);
    await context.read<VendorController>().setOrderStatus(order.id, status);
    if (mounted) setState(() => _working = null);
  }

  @override
  Widget build(BuildContext context) {
    final vendor = context.watch<VendorController>();
    final currency = context.watch<CurrencyController>();

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text('Orders',
            style: AppTypography.sectionTitle.copyWith(fontSize: 17)),
      ),
      body: SafeArea(
        child: Column(
          children: [
            SizedBox(
              height: 52,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.gutter, vertical: 8),
                children: [
                  for (final entry in _filters.entries)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(entry.value),
                        selected: _status == entry.key,
                        onSelected: (_) {
                          setState(() => _status = entry.key);
                          context
                              .read<VendorController>()
                              .loadOrders(status: entry.key);
                        },
                      ),
                    ),
                ],
              ),
            ),

            Expanded(
              child: Builder(
                builder: (context) {
                  if (vendor.loading && vendor.orders.isEmpty) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (vendor.orders.isEmpty) {
                    return const StatusView(
                      icon: Icons.receipt_long_outlined,
                      title: 'No orders here',
                      message: 'Orders from customers will appear here.',
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: () => context
                        .read<VendorController>()
                        .loadOrders(status: _status),
                    child: ListView.separated(
                      padding: const EdgeInsets.all(AppSpacing.gutter),
                      itemCount: vendor.orders.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final order = vendor.orders[index];

                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: AppDecorations.flatCard,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // The reference keeps its intrinsic width and the
                              // badge wraps to its own run if both cannot fit.
                              Wrap(
                                alignment: WrapAlignment.spaceBetween,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                spacing: 10,
                                runSpacing: 6,
                                children: [
                                  Text(order.reference,
                                      maxLines: 1,
                                      style: AppTypography.sectionTitleSmall),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppColors.primarySoft,
                                      borderRadius:
                                          BorderRadius.circular(AppRadius.xs),
                                    ),
                                    child: Text(
                                      order.status.toUpperCase(),
                                      style: AppTypography.meta
                                          .copyWith(color: AppColors.primary),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),

                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ClipRRect(
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.sm),
                                    child: AppImage(
                                      order.productImage ?? '',
                                      width: 56,
                                      height: 56,
                                      backgroundColor: AppColors.surface,
                                      padding: const EdgeInsets.all(4),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          order.productName ?? 'Product removed',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: AppTypography.body,
                                        ),
                                        const SizedBox(height: 2),
                                        Text('Qty ${order.quantity}',
                                            style: AppTypography.metaMuted),
                                        const SizedBox(height: 4),
                                        Text(currency.formatValue(order.total),
                                            style: AppTypography.price
                                                .copyWith(fontSize: 15)),
                                      ],
                                    ),
                                  ),
                                ],
                              ),

                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 10),
                                child: Divider(height: 1),
                              ),

                              Text('${order.customerName}'
                                  '${order.customerPhone != null ? ' · ${order.customerPhone}' : ''}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.metaMuted),

                              if (order.address != null) ...[
                                const SizedBox(height: 2),
                                Text(order.address!,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.metaMuted),
                              ],

                              if (order.isOpen) ...[
                                const SizedBox(height: 12),
                                // Wrap, not Row: two buttons plus a long label
                                // would otherwise overflow a small handset.
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: [
                                    if (order.nextStatus != null)
                                      PrimaryButton(
                                        label: _working == order.id
                                            ? 'Updating…'
                                            : order.nextStatusLabel,
                                        height: 40,
                                        onPressed: _working == order.id
                                            ? null
                                            : () => _advance(
                                                order, order.nextStatus!),
                                      ),
                                    TextButton(
                                      onPressed: _working == order.id
                                          ? null
                                          : () => _advance(order, 'cancelled'),
                                      child: Text('Cancel',
                                          style: AppTypography.bodyStrong
                                              .copyWith(
                                                  color:
                                                      AppColors.flashOrange)),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
