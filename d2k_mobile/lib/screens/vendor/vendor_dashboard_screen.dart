import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../state/auth_controller.dart';
import '../../state/currency_controller.dart';
import '../../state/vendor_controller.dart';
import '../../widgets/states.dart';
import 'vendor_orders_screen.dart';

/// The seller's home screen on mobile.
///
/// Reads the same `/shop/vendor/dashboard` endpoint as the website's console,
/// so a seller sees identical numbers on both — the backend is the single
/// source of truth for what a store has earned.
class VendorDashboardScreen extends StatefulWidget {
  const VendorDashboardScreen({super.key});

  @override
  State<VendorDashboardScreen> createState() => _VendorDashboardScreenState();
}

class _VendorDashboardScreenState extends State<VendorDashboardScreen> {
  @override
  void initState() {
    super.initState();
    // Deferred so the first frame paints before the request starts.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VendorController>().loadDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final vendor = context.watch<VendorController>();
    final auth = context.watch<AuthController>();
    final currency = context.watch<CurrencyController>();
    final summary = vendor.summary;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(
        backgroundColor: AppColors.brandYellow,
        elevation: 0,
        title: Text(
          summary?.name ?? auth.user?.businessName ?? 'Seller console',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.sectionTitle.copyWith(fontSize: 17),
        ),
        actions: [
          IconButton(
            tooltip: 'Log out',
            icon: const Icon(Icons.logout, size: 20),
            onPressed: () async {
              await context.read<AuthController>().logout();
              if (context.mounted) Navigator.of(context).pop();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Builder(
          builder: (context) {
            if (vendor.loading && summary == null) {
              return const Center(child: CircularProgressIndicator());
            }

            if (vendor.error != null && summary == null) {
              return StatusView(
                icon: Icons.wifi_tethering_error_rounded,
                title: 'Could not load your dashboard',
                message: vendor.error,
                actionLabel: 'Try again',
                onAction: () => context.read<VendorController>().loadDashboard(),
              );
            }

            if (summary == null) {
              return const StatusView(
                icon: Icons.storefront_outlined,
                title: 'No store data yet',
              );
            }

            return RefreshIndicator(
              onRefresh: () => context.read<VendorController>().loadDashboard(),
              child: ListView(
                padding: const EdgeInsets.all(AppSpacing.gutter),
                children: [
                  if (!summary.isApproved) _ApprovalNotice(),

                  // ---- headline figures ----
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.55,
                    children: [
                      _StatTile(
                        label: 'Earnings',
                        value: currency.formatValue(summary.earnings),
                        hint: '${currency.formatValue(summary.paidOut)} completed',
                        color: AppColors.bestSeller,
                      ),
                      _StatTile(
                        label: 'Orders',
                        value: '${summary.orders}',
                        hint: summary.ordersPending > 0
                            ? '${summary.ordersPending} need action'
                            : 'All up to date',
                        color: summary.ordersPending > 0
                            ? AppColors.flashOrange
                            : AppColors.primary,
                      ),
                      _StatTile(
                        label: 'Products',
                        value: '${summary.products}',
                        hint: '${summary.inStock} in stock',
                        color: AppColors.primary,
                      ),
                      _StatTile(
                        label: 'Units sold',
                        value: '${summary.unitsSold}',
                        hint: '${summary.lowStock} low on stock',
                        color: summary.lowStock > 0
                            ? AppColors.flashOrange
                            : AppColors.primary,
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),
                  PrimaryButton(
                    expand: true,
                    label: 'Manage orders',
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const VendorOrdersScreen(),
                      ),
                    ),
                  ),

                  if (summary.salesTrend.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Text('Last 30 days', style: AppTypography.sectionTitle),
                    const SizedBox(height: 10),
                    _TrendBars(values: summary.salesTrend),
                  ],

                  if (summary.topProducts.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Text('Best sellers', style: AppTypography.sectionTitle),
                    const SizedBox(height: 8),
                    for (final product in summary.topProducts)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: AppDecorations.flatCard,
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  product.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.body,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text('${product.units} sold',
                                      style: AppTypography.bodyStrong),
                                  Text(currency.formatValue(product.revenue),
                                      style: AppTypography.metaMuted),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ApprovalNotice extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: const Color(0xFFF0C14B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your store is awaiting approval',
              style: AppTypography.bodyStrong),
          const SizedBox(height: 4),
          Text(
            'Add your products now — they go live as soon as an administrator '
            'approves your store.',
            style: AppTypography.metaMuted,
          ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.hint,
    required this.color,
  });

  final String label;
  final String value;
  final String hint;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: AppDecorations.flatCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.meta),
          const SizedBox(height: 4),
          // The amount is the point of the tile, so it shrinks to fit rather
          // than wrapping or being clipped on a narrow handset.
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              maxLines: 1,
              style: AppTypography.price.copyWith(fontSize: 20, color: color),
            ),
          ),
          const SizedBox(height: 2),
          Text(hint,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.metaMuted),
        ],
      ),
    );
  }
}

/// Simple bar chart of daily revenue — no charting dependency for 30 values.
class _TrendBars extends StatelessWidget {
  const _TrendBars({required this.values});

  final List<double> values;

  @override
  Widget build(BuildContext context) {
    final peak = values.fold<double>(1, (max, v) => v > max ? v : max);

    return Container(
      height: 120,
      padding: const EdgeInsets.all(12),
      decoration: AppDecorations.flatCard,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final value in values)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 1),
                child: Container(
                  // A floor keeps zero-sale days visible as a baseline tick
                  // instead of vanishing and making the axis look broken.
                  height: (value / peak * 92).clamp(2, 92).toDouble(),
                  decoration: BoxDecoration(
                    color: value == 0
                        ? AppColors.divider
                        : AppColors.primary,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(2),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
