import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../domain/models/commerce.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../state/app_controllers.dart';
import '../../data/remote_shop_source.dart';
import '../../state/auth_controller.dart';
import '../account/addresses_screen.dart';
import '../../state/cart_controller.dart';
import '../../state/currency_controller.dart';
import '../../widgets/add_to_cart_button.dart';
import '../../widgets/app_image.dart';
import '../../widgets/location_header.dart';
import '../../widgets/product_card.dart';
import '../../widgets/section_header.dart';
import '../../widgets/states.dart';
import '../../widgets/toast.dart';
import '../shell/app_shell.dart';

/// Cart tab — empty state with the "Start Shopping" CTA and a bestsellers rail,
/// or the itemised basket with quantity controls and the order summary.
class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Container(
              width: double.infinity,
              color: AppColors.surface,
              child: const LocationHeader(
                padding: EdgeInsets.fromLTRB(
                    AppSpacing.gutter, 4, AppSpacing.gutter, 12),
              ),
            ),
            Expanded(
              child: cart.isEmpty
                  ? const _EmptyCart()
                  : _FilledCart(cart: cart),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    // Suggestions are drawn from products already fetched this session, so an
    // empty cart never triggers a catalogue request of its own.
    final bestsellers = context
        .read<CatalogRepository>()
        .cached
        .where((p) => p.rating >= 4)
        .take(10)
        .toList();

    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      physics: const BouncingScrollPhysics(),
      children: [
        const SizedBox(height: 34),
        Text(
          strings.cartEmptyTitle,
          textAlign: TextAlign.center,
          style: AppTypography.displayLarge,
        ),
        const SizedBox(height: 8),
        Text(
          strings.cartEmptySubtitle,
          textAlign: TextAlign.center,
          style: AppTypography.body.copyWith(
            fontSize: 16,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 28),
        const Center(child: _EmptyCartArt()),
        const SizedBox(height: 28),
        Center(
          child: PrimaryButton(
            label: strings.startShopping,
            onPressed: () => AppShell.go(context, 0),
          ),
        ),
        const SizedBox(height: 38),
        Container(
          padding: const EdgeInsets.symmetric(vertical: 18),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: AppRadius.banner,
          ),
          margin: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeader(
                title: strings.bestsellersForYou,
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.gutter, 0, AppSpacing.gutter, 12),
              ),
              HorizontalShelf(
                itemCount: bestsellers.length,
                itemBuilder: (context, index) =>
                    ProductCard(product: bestsellers[index]),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Yellow trolley illustration drawn in-app so the empty state ships with the
/// same personality as the reference without an external asset.
class _EmptyCartArt extends StatelessWidget {
  const _EmptyCartArt();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      height: 170,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Transform.rotate(
            angle: -0.22,
            child: Container(
              width: 150,
              height: 104,
              decoration: BoxDecoration(
                color: AppColors.brandYellow,
                borderRadius: BorderRadius.circular(AppRadius.md),
                boxShadow: AppShadows.raised,
              ),
              child: const Icon(Icons.shopping_cart,
                  size: 54, color: Color(0x33000000)),
            ),
          ),
          const Positioned(
            top: 6,
            right: 22,
            child: Icon(Icons.star, size: 18, color: AppColors.brandYellow),
          ),
          const Positioned(
            top: 34,
            left: 14,
            child: Icon(Icons.add, size: 20, color: AppColors.brandYellow),
          ),
          const Positioned(
            bottom: 24,
            right: 12,
            child:
                Icon(Icons.circle, size: 10, color: AppColors.brandYellowDeep),
          ),
        ],
      ),
    );
  }
}

class _FilledCart extends StatelessWidget {
  const _FilledCart({required this.cart});

  final CartController cart;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final currency = context.watch<CurrencyController>();
    final recommendations =
        context.read<CatalogRepository>().cached.take(10).toList();

    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter, 12, AppSpacing.gutter, 24),
            physics: const BouncingScrollPhysics(),
            children: [
              if (!cart.qualifiesForFreeDelivery)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF8E1),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.local_shipping_outlined,
                          size: 20, color: AppColors.brandYellowDeep),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Add ${currency.format(cart.amountToFreeDelivery)} '
                          'more for free delivery',
                          style: AppTypography.meta,
                        ),
                      ),
                    ],
                  ),
                ),
              for (final item in cart.items) ...[
                _CartRow(item: item),
                const SizedBox(height: 10),
              ],
              const SizedBox(height: 8),
              _SummaryCard(cart: cart),
              const SizedBox(height: 24),
              SectionHeader(
                title: strings.bestsellersForYou,
                padding: const EdgeInsets.only(bottom: 12),
              ),
              SizedBox(
                height: AppSizes.productShelfHeight,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: recommendations.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (context, index) =>
                      ProductCard(product: recommendations[index]),
                ),
              ),
            ],
          ),
        ),
        _CheckoutBar(cart: cart),
      ],
    );
  }
}

class _CartRow extends StatelessWidget {
  const _CartRow({required this.item});

  final CartItem item;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final cart = context.read<CartController>();
    final currency = context.watch<CurrencyController>();

    return Dismissible(
      key: ValueKey(item.key),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: AppColors.error,
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      onDismissed: (_) => cart.remove(item),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: AppDecorations.flatCard,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              child: AppImage(
                item.product.primaryImage,
                width: 88,
                height: 88,
                backgroundColor: AppColors.surface,
                padding: const EdgeInsets.all(4),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.product.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.productTitle,
                  ),
                  if (item.variantLabel != null) ...[
                    const SizedBox(height: 3),
                    Text(item.variantLabel!, style: AppTypography.metaMuted),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    currency.format(item.lineTotal),
                    style: AppTypography.price,
                  ),
                  if (item.product.hasDiscount) ...[
                    const SizedBox(height: 2),
                    Text(
                      'You save ${currency.format(item.lineSavings)}',
                      style: AppTypography.discount,
                    ),
                  ],
                  const SizedBox(height: 10),
                  // The stepper has a fixed width and the wishlist action has a
                  // long label, so on a narrow card the action drops to its own
                  // run instead of being squeezed off the row.
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    runSpacing: 4,
                    children: [
                      QuantityStepper(
                        quantity: item.quantity,
                        onIncrement: () => cart.increment(item),
                        onDecrement: () => cart.decrement(item),
                      ),
                      TextButton(
                        onPressed: () {
                          context
                              .read<WishlistController>()
                              .toggle(item.product.id);
                          cart.remove(item);
                        },
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: Text(
                          strings.moveToWishlist,
                          style: AppTypography.buttonSmall
                              .copyWith(color: AppColors.primary),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.cart});

  final CartController cart;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final currency = context.watch<CurrencyController>();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppDecorations.flatCard,
      child: Column(
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child:
                Text(strings.orderSummary, style: AppTypography.sectionTitle),
          ),
          const SizedBox(height: 14),
          _SummaryRow(
            label: '${strings.subtotal} (${cart.itemCount} items)',
            value: currency.format(cart.subtotal),
          ),
          if (!cart.savings.isZero)
            _SummaryRow(
              label: strings.discountLabel,
              value: '- ${currency.format(cart.savings)}',
              valueColor: AppColors.discountGreen,
            ),
          _SummaryRow(
            label: strings.deliveryFee,
            value: cart.delivery.isZero
                ? strings.free
                : currency.format(cart.delivery),
            valueColor: cart.delivery.isZero ? AppColors.discountGreen : null,
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1),
          ),
          Row(
            children: [
              Expanded(
                child: Text(strings.total,
                    style: AppTypography.sectionTitleSmall),
              ),
              Text(currency.format(cart.total),
                  style: AppTypography.priceHero.copyWith(fontSize: 19)),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            Expanded(child: Text(label, style: AppTypography.metaMuted)),
            Text(
              value,
              style: AppTypography.bodyStrong.copyWith(color: valueColor),
            ),
          ],
        ),
      );
}

class _CheckoutBar extends StatelessWidget {
  const _CheckoutBar({required this.cart});

  final CartController cart;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final currency = context.watch<CurrencyController>();
    final location = context.watch<LocationController>();
    // Prefer the account's saved default address — the same record the website
    // uses — and fall back to the picked delivery area for a guest.
    final address =
        location.defaultAddress?.summary ?? location.location.summary;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter, 12, AppSpacing.gutter, 12),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Where it is going, and a way to change it. Tapping opens the
            // account's saved addresses; the chosen one is used for this order.
            InkWell(
              onTap: () async {
                final picked = await Navigator.of(context).push<Address>(
                  MaterialPageRoute(
                    builder: (_) => const AddressesScreen(selectionMode: true),
                  ),
                );
                if (picked != null && context.mounted) {
                  await context.read<LocationController>().makeDefault(picked.id);
                }
              },
              child: Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    const Icon(Icons.place_outlined,
                        size: 16, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        address.isEmpty ? strings.noAddresses : address,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.metaMuted,
                      ),
                    ),
                    const Icon(Icons.chevron_right,
                        size: 18, color: AppColors.textTertiary),
                  ],
                ),
              ),
            ),
            Row(
          children: [
            // The total keeps its intrinsic width — it is never abbreviated —
            // and the CTA takes the remainder. PrimaryButton shrinks its own
            // label, so a long shilling amount can no longer overflow the bar.
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(strings.total, style: AppTypography.caption),
                Text(
                  currency.format(cart.total),
                  maxLines: 1,
                  style: AppTypography.priceHero.copyWith(fontSize: 19),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: PrimaryButton(
                label: strings.checkout,
                expand: true,
                height: 52,
                color: AppColors.primary,
                onPressed: () async {
                  final auth = context.read<AuthController>();
                  if (!auth.isAuthenticated) {
                    // Checkout needs a real account: the order is created by
                    // the backend against that account, not on the device.
                    D2KToast.show(context, strings.signInToContinue,
                        icon: Icons.lock_outline);
                    return;
                  }

                  final phone = auth.user?.phone ?? '';
                  if (address.isEmpty || phone.isEmpty) {
                    D2KToast.show(context, strings.noAddresses,
                        icon: Icons.location_off_outlined);
                    return;
                  }

                  try {
                    final order = await context.read<CartController>().checkout(
                          shop: context.read<RemoteShopSource>(),
                          address: address,
                          phone: phone,
                        );
                    if (!context.mounted) return;
                    D2KToast.show(
                      context,
                      '${strings.orderPlaced} · ${order.reference}',
                      icon: Icons.check_circle,
                      duration: const Duration(seconds: 4),
                    );
                  } catch (error) {
                    if (!context.mounted) return;
                    // The backend refuses oversells and unavailable items; its
                    // reason is shown rather than a generic success.
                    D2KToast.show(context, '$error', icon: Icons.error_outline);
                  }
                },
              ),
            ),
          ],
            ),
          ],
        ),
      ),
    );
  }
}
