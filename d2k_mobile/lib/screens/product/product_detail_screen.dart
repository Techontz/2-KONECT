import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../domain/models/product.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../state/app_controllers.dart';
import '../../state/cart_controller.dart';
import '../../state/currency_controller.dart';
import '../../widgets/app_image.dart';
import '../../widgets/badges.dart';
import '../../widgets/favourite_button.dart';
import '../../widgets/product_card.dart';
import '../../widgets/section_header.dart';
import '../../widgets/states.dart';
import '../../widgets/toast.dart';
import '../../widgets/vendor_panel.dart';
import '../cart/cart_screen.dart';
import '../home/home_screen.dart';
import '../search/search_screen.dart';

/// Product page — gallery, seller strip, price block, delivery card, overview
/// accordions, reviews, related shelves and the sticky QTY + Add to cart bar.
class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({super.key, required this.product});

  final Product product;

  static Future<void> open(BuildContext context, Product product) {
    context.read<BrowsingHistoryController>().recordView(product.id);
    return Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ProductDetailScreen(product: product)),
    );
  }

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final ScrollController _scrollController = ScrollController();
  final PageController _gallery = PageController();

  int _imageIndex = 0;
  int _quantity = 1;
  String? _selectedVariant;
  bool _showBackToTop = false;

  /// The list payload renders instantly; the full record — description,
  /// specifications, vendor contacts, reviews — arrives from the detail
  /// endpoint and replaces it.
  late Product _product;
  bool _loadingDetail = true;
  Object? _detailError;

  List<Product> _related = const [];

  Product get product => _product;

  @override
  void initState() {
    super.initState();
    _product = widget.product;
    _loadDetail();
    _scrollController.addListener(() {
      final show = _scrollController.offset > 700;
      if (show != _showBackToTop) setState(() => _showBackToTop = show);
    });
  }

  Future<void> _loadDetail() async {
    setState(() {
      _loadingDetail = true;
      _detailError = null;
    });

    final repo = context.read<CatalogRepository>();
    try {
      final full = await repo.product(widget.product.id);
      if (!mounted) return;
      setState(() {
        _product = full;
        _loadingDetail = false;
      });

      final related = await repo.related(full);
      if (mounted) setState(() => _related = related);
    } catch (error) {
      if (!mounted) return;
      // The summary stays on screen — it is real data that already loaded —
      // and the sections that need the detail call say so.
      setState(() {
        _loadingDetail = false;
        _detailError = error;
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _gallery.dispose();
    super.dispose();
  }

  void _addToCart() {
    context.read<CartController>().add(
          product,
          quantity: _quantity,
          variantLabel: _selectedVariant,
        );
    final strings = context.strings;
    D2KToast.show(
      context,
      '${product.title} · ${strings.addToCart}',
      icon: Icons.shopping_cart,
      actionLabel: strings.cart,
      onAction: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const CartScreen()),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final related = _related;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      body: Stack(
        children: [
          CustomScrollView(
            controller: _scrollController,
            physics: const BouncingScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(child: _topBar(strings)),
              SliverToBoxAdapter(child: _gallerySection()),
              // The summary above is real data that already loaded; this says
              // plainly that the rest of the page could not be fetched.
              if (_detailError != null)
                SliverToBoxAdapter(
                  child: Container(
                    width: double.infinity,
                    color: const Color(0xFFFDECEC),
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.gutter, vertical: 10),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline,
                            size: 16, color: Color(0xFFD3302F)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '$_detailError',
                            style: AppTypography.metaMuted,
                          ),
                        ),
                        TextButton(
                          onPressed: _loadDetail,
                          child: Text(strings.tryAgain),
                        ),
                      ],
                    ),
                  ),
                ),
              SliverToBoxAdapter(child: _sellerStrip()),
              SliverToBoxAdapter(child: _mainCard(strings)),
              SliverToBoxAdapter(child: _deliveryCard(strings)),
              if (product.variantGroups.isNotEmpty)
                SliverToBoxAdapter(child: _variantCard()),
              SliverToBoxAdapter(child: _trustRow(strings)),
              SliverToBoxAdapter(
                child: _shelf(strings.relatedProducts, related),
              ),
              SliverToBoxAdapter(child: _overviewCard(strings)),
              SliverToBoxAdapter(child: _additionalInfoCard(strings)),
              // Real seller: identity, admin-granted verification and the
              // contact routes the backend says are actually usable.
              if (product.vendor != null)
                SliverToBoxAdapter(
                  child: VendorPanel(vendor: product.vendor!, product: product),
                ),
              SliverToBoxAdapter(child: _reviewsCard(strings)),
              const SliverToBoxAdapter(child: SizedBox(height: 120)),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 96,
            child: BackToTopButton(
              visible: _showBackToTop,
              onTap: () => _scrollController.animateTo(
                0,
                duration: const Duration(milliseconds: 480),
                curve: Curves.easeOutCubic,
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: _purchaseBar(strings),
          ),
        ],
      ),
    );
  }

  // ------------------------------------------------------------------ parts

  Widget _topBar(AppStrings strings) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.gutter, 8, AppSpacing.gutter, 10),
        child: Row(
          children: [
            _CircleAction(
              icon: Icons.arrow_back_ios_new,
              onTap: () => Navigator.of(context).maybePop(),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: GestureDetector(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SearchScreen()),
                ),
                child: Container(
                  height: 44,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    border: Border.all(color: AppColors.divider),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.search, size: 20),
                      const SizedBox(width: 10),
                      // The bar shares its row with a back button, a heart and
                      // a cart icon, so on a 320pt screen the hint has to be
                      // able to give way rather than overflow the pill.
                      Expanded(
                        child: Text(
                          strings.searchPrefix,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.searchHint.copyWith(fontSize: 15),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Container(
              decoration: const BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
              ),
              child: FavouriteButton(
                productId: product.id,
                size: 44,
                iconSize: 21,
              ),
            ),
            const SizedBox(width: 10),
            _CircleAction(
              icon: Icons.ios_share,
              onTap: () => D2KToast.show(
                context,
                'Link copied: ${product.title}',
                icon: Icons.link,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _gallerySection() {
    return Container(
      color: AppColors.surface,
      child: Column(
        children: [
          SizedBox(
            height: 340,
            child: PageView.builder(
              controller: _gallery,
              itemCount: product.images.length,
              onPageChanged: (i) => setState(() => _imageIndex = i),
              itemBuilder: (context, index) => AppImage(
                product.images[index],
                fit: BoxFit.contain,
                backgroundColor: AppColors.surface,
                padding: const EdgeInsets.all(18),
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (product.images.length > 1)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                product.images.length,
                (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _imageIndex ? 16 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: i == _imageIndex
                        ? AppColors.textPrimary
                        : AppColors.divider,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                ),
              ),
            ),
          const SizedBox(height: 14),
        ],
      ),
    );
  }

  Widget _sellerStrip() {
    return Container(
      margin: const EdgeInsets.fromLTRB(AppSpacing.gutter, 8, AppSpacing.gutter, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              product.sellerName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.sectionTitleSmall
                  .copyWith(color: AppColors.primary),
            ),
          ),
          Text('View Products', style: AppTypography.sectionAction),
          const Icon(Icons.chevron_right, size: 18, color: AppColors.primary),
        ],
      ),
    );
  }

  Widget _mainCard(AppStrings strings) {
    final currency = context.watch<CurrencyController>();
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  product.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body.copyWith(fontSize: 15.5, height: 1.35),
                ),
              ),
              const Icon(Icons.keyboard_arrow_down,
                  color: AppColors.textSecondary),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.scaffold,
                  borderRadius: BorderRadius.circular(AppRadius.xs),
                ),
                child: RatingRow(
                  rating: product.rating,
                  reviewCount: product.reviewCount,
                  compact: false,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFFDF1E6),
                  borderRadius: BorderRadius.circular(AppRadius.xs),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.credit_card,
                        size: 14, color: Color(0xFF9A5B1E)),
                    const SizedBox(width: 5),
                    Text(
                      'M-Pesa & Cards',
                      style: AppTypography.meta
                          .copyWith(color: const Color(0xFF9A5B1E)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.end,
            children: [
              Text(currency.format(product.price),
                  style: AppTypography.priceHero),
              if (product.hasDiscount) ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text(
                    currency.formatBare(product.originalPriceBase!),
                    style: AppTypography.priceStruck.copyWith(fontSize: 14),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text(
                    '${product.discountPercent}% OFF',
                    style: AppTypography.discount.copyWith(fontSize: 14),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          if (product.rankLabel != null) RankBadge(label: product.rankLabel!),
          const SizedBox(height: 12),
          SizedBox(
            height: 42,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _CouponChip(label: 'Extra 10% cashback, CODE: TECH10'),
                const SizedBox(width: 8),
                _CouponChip(label: 'Free delivery above TZS 80,000'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(
                product.inStock ? Icons.check_circle : Icons.remove_circle,
                size: 16,
                color: product.inStock ? AppColors.success : AppColors.error,
              ),
              const SizedBox(width: 6),
              // The stock line grows with the number and with translation —
              // "Ipo · 12 available" in Swahili is longer again — so it takes
              // the remaining width rather than pushing the row past the card.
              Expanded(
                child: Text(
                  product.inStock
                      ? '${strings.inStock} · ${product.stock} available'
                      : strings.outOfStock,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.meta,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _deliveryCard(AppStrings strings) {
    final location = context.watch<LocationController>().location;
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(strings.deliveryInformation, style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.scaffold,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (product.isExpress) ...[
                      ExpressPill(label: strings.express),
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      child: Text(
                        'Get it by ${_deliveryWindow()}',
                        style: AppTypography.bodyStrong,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined,
                        size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(location.summary,
                          style: AppTypography.metaMuted),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFDECE0),
                    borderRadius: BorderRadius.circular(AppRadius.xs),
                  ),
                  child: Text(
                    'Order within 8h 25m',
                    style: AppTypography.meta
                        .copyWith(color: const Color(0xFF9A4A1E)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _deliveryWindow() {
    final now = DateTime.now();
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final from = now.add(Duration(days: product.isExpress ? 1 : 3));
    final to = now.add(Duration(days: product.isExpress ? 2 : 6));
    return '${from.day} - ${to.day} ${months[to.month - 1]}';
  }

  Widget _variantCard() {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final group in product.variantGroups) ...[
            Text(group.name, style: AppTypography.sectionTitleSmall),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final option in group.options)
                  ChoiceChip(
                    label: Text(option.label),
                    selected: _selectedVariant == option.label,
                    selectedColor: AppColors.primarySoft,
                    labelStyle: AppTypography.buttonSmall,
                    onSelected: (selected) => setState(
                      () => _selectedVariant = selected ? option.label : null,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }

  Widget _trustRow(AppStrings strings) {
    final items = [
      (Icons.verified_user_outlined, strings.secureTransaction),
      (Icons.workspace_premium_outlined, strings.highRatedSeller),
      (Icons.autorenew, strings.freeReturns),
    ];
    return _Card(
      child: Row(
        children: [
          for (final item in items)
            Expanded(
              child: Column(
                children: [
                  Icon(item.$1, size: 22, color: AppColors.primary),
                  const SizedBox(height: 8),
                  Text(
                    item.$2,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    style: AppTypography.meta,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _shelf(String title, List<Product> products) {
    if (products.isEmpty) return const SizedBox.shrink();
    return Container(
      color: AppColors.surface,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: title),
          HorizontalShelf(
            itemCount: products.length,
            itemBuilder: (context, index) =>
                ProductCard(product: products[index]),
          ),
        ],
      ),
    );
  }

  Widget _overviewCard(AppStrings strings) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(strings.productOverview, style: AppTypography.sectionTitle),
          const SizedBox(height: 10),
          _Accordion(
            title: strings.description,
            // A missing description is stated plainly. Writing marketing copy
            // for a seller who never wrote any would be inventing product data.
            child: _loadingDetail && !product.hasDescription
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 6),
                    child: LinearProgressIndicator(minHeight: 2),
                  )
                : Text(
                    product.hasDescription
                        ? product.description
                        : strings.noDescription,
                    style: AppTypography.body.copyWith(
                      color: AppColors.textSecondary,
                      fontStyle: product.hasDescription
                          ? FontStyle.normal
                          : FontStyle.italic,
                    ),
                  ),
          ),
          _Accordion(
            title: strings.highlights,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final highlight in product.highlights)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 6),
                          child: Icon(Icons.circle,
                              size: 5, color: AppColors.textSecondary),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(highlight,
                              style: AppTypography.body.copyWith(
                                  color: AppColors.textSecondary)),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          _Accordion(
            title: strings.specifications,
            child: Column(
              children: [
                for (final entry in product.specifications.entries)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 130,
                          child: Text(entry.key,
                              style: AppTypography.metaMuted),
                        ),
                        Expanded(
                          child: Text(entry.value,
                              style: AppTypography.body),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _additionalInfoCard(AppStrings strings) {
    final currency = context.watch<CurrencyController>();
    final rows = [
      (Icons.autorenew, strings.freeReturns),
      (
        Icons.local_shipping_outlined,
        '${strings.freeShippingAbove} '
            '${currency.formatValue(CartController.freeDeliveryThresholdBase)}'
      ),
      (Icons.support_agent_outlined, 'D2K support 7 days a week'),
    ];
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(strings.additionalInformation,
              style: AppTypography.sectionTitle),
          const SizedBox(height: 6),
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Icon(row.$1, size: 20, color: AppColors.primary),
                  const SizedBox(width: 12),
                  Expanded(child: Text(row.$2, style: AppTypography.body)),
                  const Icon(Icons.chevron_right,
                      size: 20, color: AppColors.textTertiary),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _reviewsCard(AppStrings strings) {
    final reviews = product.reviews.isEmpty
        ? _fallbackReviews(product)
        : product.reviews;
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(strings.ratingsAndReviews, style: AppTypography.sectionTitle),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(product.rating.toStringAsFixed(1),
                  style: AppTypography.displayLarge),
              const SizedBox(width: 10),
              Row(
                children: List.generate(
                  5,
                  (i) => Icon(
                    i < product.rating.round()
                        ? Icons.star
                        : Icons.star_border,
                    size: 20,
                    color: AppColors.ratingGreen,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Average rating from ${product.reviewCount} verified D2K shoppers',
            style: AppTypography.metaMuted,
          ),
          const SizedBox(height: 16),
          Text('${strings.allReviews} (${reviews.length})',
              style: AppTypography.sectionTitleSmall),
          const SizedBox(height: 10),
          for (final review in reviews)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      // The reviewer name yields space to the fixed-width
                      // verified chip instead of pushing it off the card.
                      Expanded(
                        child: Text(
                          review.author,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyStrong,
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (review.verified)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEAF7EF),
                            borderRadius: BorderRadius.circular(AppRadius.xs),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.check_circle,
                                  size: 13, color: AppColors.success),
                              const SizedBox(width: 4),
                              Text(strings.verifiedPurchase,
                                  style: AppTypography.meta),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Row(
                        children: List.generate(
                          5,
                          (i) => Icon(
                            i < review.rating.round()
                                ? Icons.star
                                : Icons.star_border,
                            size: 15,
                            color: AppColors.ratingGreen,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text('· ${review.timeAgo}',
                          style: AppTypography.metaMuted),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(review.title, style: AppTypography.bodyStrong),
                  Text(review.body, style: AppTypography.metaMuted),
                ],
              ),
            ),
        ],
      ),
    );
  }

  List<ProductReview> _fallbackReviews(Product product) => const [
        ProductReview(
          author: 'Neema S.',
          rating: 5,
          title: 'Bidhaa nzuri sana',
          body: 'Arrived in Dar within two days and exactly as described.',
          timeAgo: '3 weeks ago',
        ),
        ProductReview(
          author: 'Juma M.',
          rating: 4,
          title: 'Good value',
          body: 'Quality is solid for the price. Packaging could be better.',
          timeAgo: '2 months ago',
        ),
      ];

  Widget _purchaseBar(AppStrings strings) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter, 10, AppSpacing.gutter, 10),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            GestureDetector(
              onTap: _pickQuantity,
              child: Container(
                width: 74,
                height: 54,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: AppColors.divider),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(strings.qty,
                        style: AppTypography.caption.copyWith(fontSize: 10.5)),
                    Text('$_quantity', style: AppTypography.bodyStrong),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: PrimaryButton(
                label: product.inStock
                    ? strings.addToCart
                    : strings.outOfStock,
                expand: true,
                height: 54,
                color: AppColors.primary,
                onPressed: product.inStock ? _addToCart : null,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickQuantity() async {
    final selected = await showModalBottomSheet<int>(
      context: context,
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 16),
            Text(context.strings.qty, style: AppTypography.sectionTitle),
            const SizedBox(height: 8),
            SizedBox(
              height: 260,
              child: ListView.builder(
                itemCount: 10,
                itemBuilder: (context, index) => ListTile(
                  title: Text('${index + 1}',
                      textAlign: TextAlign.center,
                      style: AppTypography.body),
                  onTap: () => Navigator.of(sheetContext).pop(index + 1),
                ),
              ),
            ),
          ],
        ),
      ),
    );
    if (selected != null) setState(() => _quantity = selected);
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(
            AppSpacing.gutter, 12, AppSpacing.gutter, 0),
        padding: const EdgeInsets.all(14),
        decoration: AppDecorations.flatCard,
        child: child,
      );
}

class _CircleAction extends StatelessWidget {
  const _CircleAction({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
        color: AppColors.surface,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icon, size: 19, color: AppColors.textPrimary),
          ),
        ),
      );
}

class _CouponChip extends StatelessWidget {
  const _CouponChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: AppColors.success),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.percent, size: 14, color: AppColors.success),
            const SizedBox(width: 8),
            Text(label, style: AppTypography.buttonSmall),
            const SizedBox(width: 6),
            const Icon(Icons.chevron_right,
                size: 16, color: AppColors.textSecondary),
          ],
        ),
      );
}

class _Accordion extends StatefulWidget {
  const _Accordion({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  State<_Accordion> createState() => _AccordionState();
}

class _AccordionState extends State<_Accordion> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.scaffold,
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _open = !_open),
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(widget.title,
                        style: AppTypography.sectionTitleSmall
                            .copyWith(fontSize: 15)),
                  ),
                  AnimatedRotation(
                    duration: const Duration(milliseconds: 200),
                    turns: _open ? 0.5 : 0,
                    child: const Icon(Icons.keyboard_arrow_down),
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 220),
            crossFadeState:
                _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            firstChild: const SizedBox(width: double.infinity),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: SizedBox(width: double.infinity, child: widget.child),
            ),
          ),
        ],
      ),
    );
  }
}
