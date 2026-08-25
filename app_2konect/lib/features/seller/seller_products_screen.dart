import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/tokens.dart';
import '../../models/product.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../widgets/product_grid.dart';
import '../../widgets/states.dart';

/// A seller's own listings.
///
/// Read-only on the phone. Creating and editing a product means uploading
/// several photographs, setting variants and writing specifications — work the
/// seller console on the website already does properly, and which a phone form
/// would do worse. Rather than ship a half version, the app shows the store
/// accurately and leaves authoring where it belongs.
final _sellerProductsProvider = FutureProvider<List<ProductCardModel>>((ref) async {
  return ref.watch(sellerServiceProvider).products();
});

class SellerProductsScreen extends ConsumerWidget {
  const SellerProductsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(_sellerProductsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('seller.myProducts'))),
      body: products.when(
        loading: () => const Loading(),
        error: (error, _) =>
            ErrorState(error: error, onRetry: () => ref.invalidate(_sellerProductsProvider)),
        data: (data) => data.isEmpty
            ? EmptyState(
                icon: Icons.inventory_2_outlined,
                title: ref.t('seller.noProductsFound'),
                message: ref.t('seller.addFirstProduct'),
              )
            : RefreshIndicator(
                color: K.brand,
                onRefresh: () async => ref.refresh(_sellerProductsProvider.future),
                child: ProductGridView(products: data),
              ),
      ),
    );
  }
}
