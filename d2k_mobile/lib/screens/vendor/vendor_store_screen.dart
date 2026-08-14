import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../domain/models/product.dart';
import '../../domain/models/vendor.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../widgets/app_image.dart';
import '../../widgets/async_state.dart';
import '../../widgets/product_card.dart';
import '../../widgets/vendor_panel.dart';

/// A seller's store page: who they are, and everything they have listed.
///
/// The verified checkmark is shown for [Vendor.isVerified] only — being
/// approved to sell is a different fact and does not earn the badge.
class VendorStoreScreen extends StatefulWidget {
  const VendorStoreScreen({super.key, required this.vendor});

  final Vendor vendor;

  @override
  State<VendorStoreScreen> createState() => _VendorStoreScreenState();
}

class _VendorStoreScreenState extends State<VendorStoreScreen> {
  Loadable<List<Product>> _products = const Loadable.loading();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _products = const Loadable.loading());
    try {
      final products =
          await context.read<CatalogRepository>().byVendor(widget.vendor.id);
      if (mounted) setState(() => _products = Loadable.ready(products));
    } catch (error) {
      if (mounted) setState(() => _products = Loadable.failed(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final vendor = widget.vendor;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(title: Text(vendor.name)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _header(strings)),
            SliverToBoxAdapter(
              child: VendorPanel(vendor: vendor),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.gutter, 20, AppSpacing.gutter, 10),
                child: Text(strings.productsLabel, style: AppTypography.sectionTitle),
              ),
            ),
            _productSliver(strings),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  Widget _productSliver(AppStrings strings) {
    if (_products.isLoading) {
      return const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 40),
          child: LoadingState(),
        ),
      );
    }

    if (_products.hasFailed) {
      return SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 30),
          child: ErrorState(
            message: _products.message,
            onRetry: _load,
            canRetry: _products.isRetryable,
          ),
        ),
      );
    }

    final products = _products.value ?? const <Product>[];
    if (products.isEmpty) {
      return SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 30),
          child: EmptyState(
            title: strings.noProductsFound,
            icon: Icons.inventory_2_outlined,
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.56,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, index) => ProductCard(product: products[index]),
          childCount: products.length,
        ),
      ),
    );
  }

  Widget _header(AppStrings strings) {
    final vendor = widget.vendor;

    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.all(AppSpacing.gutter),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.md),
            child: vendor.logo.isNotEmpty
                ? AppImage(
                    vendor.logo,
                    width: 64,
                    height: 64,
                    fit: BoxFit.cover,
                    backgroundColor: AppColors.tileSurface,
                  )
                : Container(
                    width: 64,
                    height: 64,
                    color: AppColors.brandYellow,
                    alignment: Alignment.center,
                    child: Text(
                      vendor.name.isEmpty ? 'D' : vendor.name[0].toUpperCase(),
                      style: AppTypography.sectionTitle,
                    ),
                  ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        vendor.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.sectionTitle,
                      ),
                    ),
                    if (vendor.isVerified) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.verified,
                          size: 17, color: AppColors.primary),
                    ],
                  ],
                ),
                if (vendor.location != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.place_outlined,
                          size: 14, color: AppColors.textTertiary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          vendor.location!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.metaMuted,
                        ),
                      ),
                    ],
                  ),
                ],
                if (vendor.memberSince != null) ...[
                  const SizedBox(height: 3),
                  Text('${strings.soldBy} · ${vendor.memberSince}',
                      style: AppTypography.metaMuted),
                ],
                if (vendor.about != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    vendor.about!,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.metaMuted,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
