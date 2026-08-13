import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../state/app_controllers.dart';
import '../../widgets/product_card.dart';
import '../../widgets/states.dart';

class WishlistScreen extends StatelessWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final wishlist = context.watch<WishlistController>();
    final products = wishlist.products;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          '${strings.wishlist} (${products.length})',
          style: AppTypography.sectionTitle.copyWith(fontSize: 17),
        ),
      ),
      body: products.isEmpty
          ? StatusView(
              icon: Icons.favorite_border,
              title: strings.wishlistEmptyTitle,
              message: strings.wishlistEmptyBody,
            )
          : GridView.builder(
              padding: const EdgeInsets.all(AppSpacing.gutter),
              physics: const BouncingScrollPhysics(),
              itemCount: products.length,
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                mainAxisExtent: AppSizes.productGridExtentFor(context),
              ),
              itemBuilder: (context, index) =>
                  ProductCard.grid(product: products[index]),
            ),
    );
  }
}
