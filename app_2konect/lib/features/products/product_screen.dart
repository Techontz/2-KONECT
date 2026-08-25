import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/config/env.dart';
import '../../core/format.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../models/product.dart';
import '../../providers/cart.dart';
import '../../providers/catalog.dart';
import '../../providers/language.dart';
import '../../providers/wishlist.dart';
import '../../widgets/availability.dart';
import '../../widgets/primitives.dart';
import '../../widgets/product_shelf.dart';
import '../../widgets/states.dart';
import 'widgets/buying_options.dart';
import 'widgets/product_gallery.dart';
import 'widgets/seller_panel.dart';
import 'widgets/variant_picker.dart';

/// The product page.
///
/// It answers, in order: what is it, what does it cost, where is it and when
/// would it arrive, how do I buy it, and who am I buying it from. The
/// availability block sits above the fold because on 2KONECT that is the
/// single most consequential fact about a listing.
///
/// If the shopper arrived from a card, the card's own copy paints the first
/// frame while the full payload is still in flight, so the screen opens with
/// content rather than with a spinner.
class ProductScreen extends ConsumerStatefulWidget {
  const ProductScreen({super.key, required this.productId});

  final int productId;

  @override
  ConsumerState<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends ConsumerState<ProductScreen> {
  /// Which way to buy it — the product's own offer, or an imported
  /// alternative. Null until the payload arrives and the first is chosen.
  BuyingOption? _option;

  /// `{attribute_id: attribute_value_id}` for a product that sells by
  /// combination.
  final Map<int, int> _selection = {};

  int _quantity = 1;

  @override
  Widget build(BuildContext context) {
    final page = ref.watch(productProvider(widget.productId));
    final preview = ref.watch(productPreviewProvider)[widget.productId];

    return Scaffold(
      body: page.when(
        loading: () => _Frame(
          title: preview?.name,
          child: preview == null
              ? const Loading(padding: EdgeInsets.only(top: 120))
              : _Preview(product: preview),
        ),
        error: (error, _) => _Frame(
          child: ErrorState(
            error: error,
            onRetry: () => ref.invalidate(productProvider(widget.productId)),
          ),
        ),
        data: (data) => _Loaded(
          page: data,
          option: _option,
          selection: _selection,
          quantity: _quantity,
          onOption: (option) => setState(() {
            _option = option;
            _quantity = 1;
          }),
          onSelect: (attributeId, valueId) => setState(() {
            _selection[attributeId] = valueId;
          }),
          onQuantity: (value) => setState(() => _quantity = value),
        ),
      ),
    );
  }
}

/// The shell used while loading and on failure, so the back button and the
/// title are present from the first frame.
class _Frame extends StatelessWidget {
  const _Frame({required this.child, this.title});

  final Widget child;
  final String? title;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(title ?? '2KONECT')),
        body: child,
      );
}

class _Preview extends StatelessWidget {
  const _Preview({required this.product});

  final ProductCardModel product;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        AspectRatio(
          aspectRatio: 1,
          child: ColoredBox(
            color: Colors.white,
            child: ProductImage(url: product.image, padding: const EdgeInsets.all(24)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AvailabilityStrip(sourcing: product.sourcing),
              const SizedBox(height: K.s8),
              Text(product.name, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: K.s10),
              PriceBlock(price: product.price, size: 22),
              const SizedBox(height: K.s24),
              const Loading(padding: EdgeInsets.zero),
            ],
          ),
        ),
      ],
    );
  }
}

class _Loaded extends ConsumerWidget {
  const _Loaded({
    required this.page,
    required this.option,
    required this.selection,
    required this.quantity,
    required this.onOption,
    required this.onSelect,
    required this.onQuantity,
  });

  final ProductPage page;
  final BuyingOption? option;
  final Map<int, int> selection;
  final int quantity;
  final ValueChanged<BuyingOption> onOption;
  final void Function(int attributeId, int valueId) onSelect;
  final ValueChanged<int> onQuantity;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final product = page.product;

    /// Which offer is live: the one chosen, or the primary.
    final chosen = option ??
        (product.buyingOptions.isNotEmpty ? product.buyingOptions.first : null);
    final sourcing = chosen?.sourcing ?? product.sourcing;

    /// Which combination is live, when the product sells by one.
    final variant = _resolveVariant(product, selection);
    final needsChoice = product.hasVariants && variant == null;

    final price = variant?.price ?? chosen?.price ?? product.price;
    final stock = variant?.stock ?? chosen?.stock ?? product.stock;
    final inStock = variant?.inStock ?? chosen?.inStock ?? product.inStock;

    // An import is bought to order, so a zero on hand does not make it
    // unbuyable — only local stock actually runs out.
    final buyable = (sourcing.isLocal ? inStock : true) && !needsChoice;

    final saved = ref.watch(wishlistProvider).has(product.id);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: MediaQuery.sizeOf(context).width * 0.92,
            backgroundColor: K.brand,
            // Product photography is overwhelmingly white, and white icons on
            // a white plate are not icons. Every control over the gallery gets
            // its own frosted disc, and the status bar is told to draw dark —
            // the same treatment the card's wishlist button already uses, for
            // the same reason.
            systemOverlayStyle: const SystemUiOverlayStyle(
              statusBarColor: Colors.transparent,
              statusBarIconBrightness: Brightness.dark,
              statusBarBrightness: Brightness.light,
            ),
            leading: _GalleryControl(
              icon: Icons.arrow_back_rounded,
              tooltip: ref.t('common.back'),
              onTap: () => Navigator.of(context).maybePop(),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: ProductGallery(images: product.gallery),
              collapseMode: CollapseMode.parallax,
            ),
            actions: [
              _GalleryControl(
                icon: saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                colour: saved ? K.sale : K.ink,
                tooltip: ref.t(saved ? 'product.removeFromWishlist' : 'product.saveToWishlist'),
                onTap: () => ref.read(wishlistProvider.notifier).toggle(product.id),
              ),
              _GalleryControl(
                icon: Icons.ios_share_rounded,
                tooltip: ref.t('app.share'),
                onTap: () => Share.share(
                  '${product.name}\n${Env.siteUrl}/product/?id=${product.id}',
                ),
              ),
              const SizedBox(width: K.s4),
            ],
          ),
          SliverToBoxAdapter(
            child: Container(
              color: K.surface,
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (product.category != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 7),
                      child: Text(
                        [product.category!.name, product.subcategory?.name]
                            .whereType<String>()
                            .join('  ·  '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: KType.tag.copyWith(color: K.inkFaint),
                      ),
                    ),
                  Text(
                    product.name,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  if ((product.shortDescription ?? '').isNotEmpty) ...[
                    const SizedBox(height: K.s8),
                    Text(
                      product.shortDescription!,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                  if (product.rating.rating.hasReviews) ...[
                    const SizedBox(height: K.s10),
                    Row(
                      children: [
                        RatingPill(rating: product.rating.rating, showCount: true),
                        const SizedBox(width: K.s8),
                        Text(
                          ref.t('product.reviewCount', {'count': product.rating.rating.count}),
                          style: const TextStyle(fontSize: 12, color: K.inkFaint),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: K.s14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      PriceBlock(
                        price: price,
                        size: 28,
                        fromLabel: needsChoice && (product.variantSummary?.isRange ?? false)
                            ? ref.t('product.from')
                            : null,
                      ),
                      const SizedBox(width: K.s10),
                      if (price.discountPercent != null && price.discountPercent! > 0)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Tag(
                            ref.t('product.save', {'percent': price.discountPercent}),
                            tone: Tone.sale,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: SourcingPanel(sourcing: sourcing, etaLabel: ref.t('product.arrives')),
            ),
          ),

          if (product.buyingOptions.length > 1)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: BuyingOptions(
                  options: product.buyingOptions,
                  selected: chosen,
                  onSelect: onOption,
                ),
              ),
            ),

          if (product.hasVariants)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: VariantPicker(
                  axes: product.options,
                  variants: product.variants,
                  selection: selection,
                  onSelect: onSelect,
                ),
              ),
            ),

          if (product.priceTiers.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: _BulkPricing(tiers: product.priceTiers, quantity: quantity),
              ),
            ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: _StockLine(sourcing: sourcing, stock: stock, inStock: inStock),
            ),
          ),

          if (product.vendor != null)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: SellerPanel(vendor: product.vendor!, productId: product.id),
              ),
            ),

          if ((product.description ?? '').isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: _Section(
                  title: ref.t('product.aboutThisProduct'),
                  child: Text(
                    product.description!,
                    style: const TextStyle(fontSize: 13.5, height: 1.6, color: K.inkSoft),
                  ),
                ),
              ),
            ),

          if (product.specifications.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: _Specifications(specifications: product.specifications),
              ),
            ),

          if (product.reviews.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: _Reviews(product: product),
              ),
            ),

          if (page.related.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: K.gapSection),
                child: ProductShelf(
                  title: ref.t('product.relatedProducts'),
                  products: page.related,
                ),
              ),
            ),

          if (page.fromVendor.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: K.gapSection),
                child: ProductShelf(
                  title: ref.t('product.moreFromSeller'),
                  products: page.fromVendor,
                ),
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: K.s28)),
        ],
      ),
      bottomNavigationBar: _BuyBar(
        product: product,
        option: chosen,
        variant: variant,
        quantity: quantity,
        buyable: buyable,
        needsChoice: needsChoice,
        maxQuantity: sourcing.isImport ? 99 : (stock <= 0 ? 1 : stock.clamp(1, 99)),
        onQuantity: onQuantity,
      ),
    );
  }

  /// The combination the shopper has picked, once every axis has an answer.
  static ProductVariant? _resolveVariant(ProductDetail product, Map<int, int> selection) {
    if (!product.hasVariants) return null;
    if (selection.length < product.options.length) return null;
    for (final variant in product.variants) {
      if (variant.matches(selection)) return variant;
    }
    return null;
  }
}

/// A control that has to stay legible over an unknown photograph.
///
/// A frosted white disc with the glyph in ink, rather than a bare white icon:
/// the gallery behind it is whatever the seller uploaded, and half of the
/// catalogue is a product shot on a white sweep.
class _GalleryControl extends StatelessWidget {
  const _GalleryControl({
    required this.icon,
    required this.onTap,
    this.tooltip,
    this.colour = K.ink,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? tooltip;
  final Color colour;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Tooltip(
        message: tooltip ?? '',
        child: DecoratedBox(
          decoration: const BoxDecoration(shape: BoxShape.circle, boxShadow: K.shadowCard),
          child: Material(
            color: Colors.white.withValues(alpha: 0.92),
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: SizedBox(
                width: 38,
                height: 38,
                child: Icon(icon, size: 19, color: colour),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: K.s10),
            child,
          ],
        ),
      );
}

/// Quantity breaks — the price falls as the order grows.
class _BulkPricing extends ConsumerWidget {
  const _BulkPricing({required this.tiers, required this.quantity});

  final List<PriceTier> tiers;
  final int quantity;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _Section(
      title: ref.t('productForm.bulkPricing'),
      child: Column(
        children: [
          for (final tier in tiers)
            Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: tier.covers(quantity) ? K.brand50 : K.surfaceAlt,
                borderRadius: K.radius(K.rSm),
                border: Border.all(color: tier.covers(quantity) ? K.brand200 : K.line),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      tier.label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: tier.covers(quantity) ? FontWeight.w700 : FontWeight.w600,
                        color: tier.covers(quantity) ? K.brand : K.inkSoft,
                      ),
                    ),
                  ),
                  Text(
                    Money.format(tier.unitPrice),
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w800,
                      color: tier.covers(quantity) ? K.brand : K.ink,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// How much is left — but only where "left" means anything.
class _StockLine extends ConsumerWidget {
  const _StockLine({required this.sourcing, required this.stock, required this.inStock});

  final dynamic sourcing;
  final int stock;
  final bool inStock;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // An import is bought to order — quoting "3 left" for something that has
    // not been purchased from the supplier yet would be an invention.
    if (sourcing.isImport as bool) {
      return Row(
        children: [
          const Icon(Icons.all_inclusive_rounded, size: 15, color: K.import),
          const SizedBox(width: K.s8),
          Expanded(
            child: Text(
              ref.t('product.madeToOrder'),
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: K.inkMuted),
            ),
          ),
        ],
      );
    }

    if (!inStock) {
      return Row(
        children: [
          const Icon(Icons.remove_circle_outline_rounded, size: 15, color: K.danger),
          const SizedBox(width: K.s8),
          Text(
            ref.t('product.soldOut'),
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: K.danger),
          ),
        ],
      );
    }

    final low = stock > 0 && stock <= 5;
    return Row(
      children: [
        Icon(
          low ? Icons.warning_amber_rounded : Icons.check_circle_outline_rounded,
          size: 15,
          color: low ? K.warn : K.success,
        ),
        const SizedBox(width: K.s8),
        Text(
          low ? ref.t('cart.onlyLeft', {'count': stock}) : ref.t('product.inStock'),
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: low ? K.warn : K.success,
          ),
        ),
      ],
    );
  }
}

class _Specifications extends ConsumerWidget {
  const _Specifications({required this.specifications});

  final List<Specification> specifications;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _Section(
      title: ref.t('product.specifications'),
      child: Column(
        children: [
          for (var i = 0; i < specifications.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: BoxDecoration(
                border: i == specifications.length - 1
                    ? null
                    : const Border(bottom: BorderSide(color: K.line)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 128,
                    child: Text(
                      specifications[i].label,
                      style: const TextStyle(fontSize: 12.5, color: K.inkMuted),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      specifications[i].value,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: K.ink,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Reviews extends ConsumerWidget {
  const _Reviews({required this.product});

  final ProductDetail product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _Section(
      title: ref.t('product.reviews'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                product.rating.rating.average.toStringAsFixed(1),
                style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, height: 1),
              ),
              const SizedBox(width: K.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        for (var star = 1; star <= 5; star++)
                          Icon(
                            star <= product.rating.rating.average.round()
                                ? Icons.star_rounded
                                : Icons.star_border_rounded,
                            size: 16,
                            color: const Color(0xFFF5A623),
                          ),
                      ],
                    ),
                    Text(
                      ref.t('product.reviewCount', {'count': product.rating.rating.count}),
                      style: const TextStyle(fontSize: 12, color: K.inkFaint),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: K.s14),
          for (final review in product.reviews.take(5))
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        review.author,
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(width: K.s8),
                      for (var star = 1; star <= 5; star++)
                        Icon(
                          star <= review.rating ? Icons.star_rounded : Icons.star_border_rounded,
                          size: 12,
                          color: const Color(0xFFF5A623),
                        ),
                      const Spacer(),
                      if (review.date != null)
                        Text(
                          review.date!,
                          style: const TextStyle(fontSize: 11, color: K.inkFaint),
                        ),
                    ],
                  ),
                  if ((review.comment ?? '').isNotEmpty) ...[
                    const SizedBox(height: K.s4),
                    Text(
                      review.comment!,
                      style: const TextStyle(fontSize: 12.5, height: 1.5, color: K.inkSoft),
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

/// The bar that never leaves the screen: quantity, and buying it.
class _BuyBar extends ConsumerWidget {
  const _BuyBar({
    required this.product,
    required this.option,
    required this.variant,
    required this.quantity,
    required this.buyable,
    required this.needsChoice,
    required this.maxQuantity,
    required this.onQuantity,
  });

  final ProductDetail product;
  final BuyingOption? option;
  final ProductVariant? variant;
  final int quantity;
  final bool buyable;
  final bool needsChoice;
  final int maxQuantity;
  final ValueChanged<int> onQuantity;

  void _add(BuildContext context, WidgetRef ref, {required bool checkout}) {
    ref.read(cartProvider.notifier).add(
          product.toCard(),
          quantity: quantity,
          option: option?.id == null ? null : option,
          variantId: variant?.id,
          variantLabel: _variantLabel(),
        );

    if (checkout) {
      context.push('/cart');
      return;
    }

    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Text(ref.read(tProvider)('product.added')),
          action: SnackBarAction(
            label: ref.read(tProvider)('cart.checkoutShort'),
            textColor: Colors.white,
            onPressed: () => context.push('/cart'),
          ),
        ),
      );
  }

  /// The combination in the words it was chosen under, frozen onto the line.
  String? _variantLabel() {
    if (variant == null) return null;
    final parts = <String>[];
    for (final axis in product.options) {
      final valueId = variant!.options[axis.attributeId];
      final value = axis.values.where((v) => v.id == valueId).firstOrNull;
      if (value != null) parts.add('${axis.name}: ${value.value}');
    }
    return parts.isEmpty ? null : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: const BoxDecoration(
        color: K.surface,
        border: Border(top: BorderSide(color: K.line)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
          child: Row(
            children: [
              _QuantityStepper(
                value: quantity,
                max: maxQuantity,
                onChanged: onQuantity,
                enabled: buyable,
              ),
              const SizedBox(width: K.s10),
              Expanded(
                child: FilledButton(
                  onPressed: buyable ? () => _add(context, ref, checkout: false) : null,
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 50)),
                  child: Text(
                    needsChoice
                        ? ref.t('product.chooseOptions')
                        : buyable
                            ? ref.t('product.addToCart')
                            : ref.t('product.soldOut'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.value,
    required this.max,
    required this.onChanged,
    this.enabled = true,
  });

  final int value;
  final int max;
  final ValueChanged<int> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 50,
      decoration: BoxDecoration(
        color: K.surfaceAlt,
        borderRadius: K.radius(K.rSm),
        border: K.hairline,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Step(
            icon: Icons.remove_rounded,
            onTap: enabled && value > 1 ? () => onChanged(value - 1) : null,
          ),
          SizedBox(
            width: 30,
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
            ),
          ),
          _Step(
            icon: Icons.add_rounded,
            onTap: enabled && value < max ? () => onChanged(value + 1) : null,
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkResponse(
        onTap: onTap,
        radius: 22,
        child: SizedBox(
          width: 38,
          height: 48,
          child: Icon(icon, size: 17, color: onTap == null ? K.lineStrong : K.inkSoft),
        ),
      );
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
