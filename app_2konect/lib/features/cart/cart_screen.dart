import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/format.dart';
import '../../core/theme/tokens.dart';
import '../../models/cart.dart';
import '../../providers/cart.dart';
import '../../providers/catalog.dart';
import '../../providers/language.dart';
import '../../widgets/availability.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// The basket.
///
/// Everything the customer is shown here is priced by the server. The device
/// remembers what was picked up; `/shop/cart/quote` decides what it costs,
/// using the same code that will charge for it — which is what makes quantity
/// tiers and variant prices correct rather than approximately correct.
class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lines = ref.watch(cartProvider);
    final quote = ref.watch(cartQuoteProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('cart.title')),
        actions: [
          if (lines.isNotEmpty)
            TextButton(
              onPressed: () => _confirmClear(context, ref),
              style: TextButton.styleFrom(foregroundColor: Colors.white),
              child: Text(ref.t('common.clear')),
            ),
        ],
      ),
      body: lines.isEmpty
          ? EmptyState(
              icon: Icons.shopping_cart_outlined,
              title: ref.t('cart.empty'),
              message: ref.t('cart.emptyHint'),
              actionLabel: ref.t('cart.startShopping'),
              onAction: () => context.go('/shop'),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
              children: [
                if (ref.watch(cartHasImportProvider)) ...[
                  const _PrepaymentNotice(),
                  const SizedBox(height: K.s12),
                ],
                for (final line in lines) ...[
                  _CartRow(
                    line: line,
                    quoted: quote.valueOrNull?.lineFor(line),
                  ),
                  const SizedBox(height: K.s10),
                ],
                const SizedBox(height: K.s4),
                _Summary(quote: quote, lines: lines),
              ],
            ),
      bottomNavigationBar: lines.isEmpty ? null : _CheckoutBar(quote: quote),
    );
  }

  static Future<void> _confirmClear(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(ref.read(tProvider)('cart.title')),
        content: Text(ref.read(tProvider)('app.clearCartConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(ref.read(tProvider)('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(ref.read(tProvider)('common.clear')),
          ),
        ],
      ),
    );
    if (confirmed == true) ref.read(cartProvider.notifier).clear();
  }
}

/// Stated in the basket, not sprung at checkout: this order will be prepaid.
class _PrepaymentNotice extends ConsumerWidget {
  const _PrepaymentNotice();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      color: K.importSoft,
      border: Border.all(color: K.importLine),
      padding: const EdgeInsets.all(13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.flight_takeoff_rounded, size: 18, color: K.import),
          const SizedBox(width: K.s10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ref.t('cart.orderAbroad'),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: K.import,
                  ),
                ),
                const SizedBox(height: K.s4),
                Text(
                  ref.t('payment.mixedBasketNote'),
                  style: const TextStyle(fontSize: 12, height: 1.45, color: K.inkSoft),
                ),
                const SizedBox(height: K.s6),
                Text(
                  ref.t('payment.deliveryNotIncluded', {'country': Brand.country}),
                  style: const TextStyle(fontSize: 11.5, height: 1.45, color: K.inkMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CartRow extends ConsumerWidget {
  const _CartRow({required this.line, required this.quoted});

  final CartLine line;

  /// The server's word on this line. Null while the quote is in flight — the
  /// row shows the price it was added at until the real one lands.
  final QuoteLine? quoted;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.read(cartProvider.notifier);
    final unit = quoted?.unitPrice ?? line.option?.price ?? line.product.price;
    final total = quoted?.total;

    return Panel(
      padding: const EdgeInsets.all(11),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: () {
                  ref.read(productPreviewProvider.notifier).seed(line.product);
                  context.push('/product/${line.product.id}');
                },
                child: Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: K.radius(K.rSm),
                    border: K.hairline,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: ProductImage(
                    url: line.product.image,
                    padding: const EdgeInsets.all(6),
                    decodeWidth: 160,
                  ),
                ),
              ),
              const SizedBox(width: K.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AvailabilityBadge(sourcing: line.sourcing, dense: true),
                    const SizedBox(height: K.s4),
                    Text(
                      line.product.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (line.variantLabel != null) ...[
                      const SizedBox(height: K.s4),
                      Text(
                        line.variantLabel!,
                        style: const TextStyle(fontSize: 11.5, color: K.inkMuted),
                      ),
                    ],
                    const SizedBox(height: K.s6),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            Money.format(unit.current, unit.currency),
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                          ),
                        ),
                        if (quoted?.tier != null)
                          Tag(quoted!.tier!.label, tone: Tone.brand),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: K.s10),
          Row(
            children: [
              _Stepper(
                value: line.quantity,
                onChanged: (value) => cart.setQuantity(line.key, value),
              ),
              const Spacer(),
              if (total != null)
                Text(
                  Money.format(total.current, total.currency),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: K.brand),
                ),
              const SizedBox(width: K.s6),
              IconButton(
                tooltip: ref.t('cart.remove'),
                onPressed: () => cart.remove(line.key),
                icon: const Icon(Icons.delete_outline_rounded, size: 19),
                color: K.inkMuted,
                visualDensity: VisualDensity.compact,
              ),
            ],
          ),
          if (quoted != null && !quoted!.purchasable) ...[
            const SizedBox(height: K.s8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: K.dangerSoft,
                borderRadius: K.radius(K.rXs),
              ),
              child: Text(
                // The server's own reason, already in the customer's words.
                quoted!.reason ?? ref.t('product.currentlyUnavailable'),
                style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: K.danger),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, required this.onChanged});

  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      decoration: BoxDecoration(borderRadius: K.radius(K.rSm), border: K.hairline),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkResponse(
            onTap: value > 1 ? () => onChanged(value - 1) : null,
            radius: 18,
            child: SizedBox(
              width: 32,
              height: 32,
              child: Icon(
                Icons.remove_rounded,
                size: 15,
                color: value > 1 ? K.inkSoft : K.lineStrong,
              ),
            ),
          ),
          SizedBox(
            width: 26,
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
            ),
          ),
          InkResponse(
            onTap: () => onChanged(value + 1),
            radius: 18,
            child: const SizedBox(
              width: 32,
              height: 32,
              child: Icon(Icons.add_rounded, size: 15, color: K.inkSoft),
            ),
          ),
        ],
      ),
    );
  }
}

class _Summary extends ConsumerWidget {
  const _Summary({required this.quote, required this.lines});

  final AsyncValue<CartQuote> quote;
  final List<CartLine> lines;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = lines.fold<int>(0, (sum, line) => sum + line.quantity);
    final hasImport = lines.any((line) => line.isImport);

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(ref.t('cart.orderSummary'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: K.s12),
          Row(
            children: [
              Expanded(
                child: Text(
                  count == 1
                      ? ref.t('cart.subtotalItemOne')
                      : ref.t('cart.subtotalItems', {'count': count}),
                  style: const TextStyle(fontSize: 13, color: K.inkMuted),
                ),
              ),
              quote.when(
                loading: () => const Skeleton(width: 82, height: 15),
                error: (_, _) => Text(
                  '—',
                  style: const TextStyle(fontSize: 14, color: K.inkFaint),
                ),
                data: (data) => Text(
                  Money.format(data.subtotal.current, data.subtotal.currency),
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: K.s10),
          Row(
            children: [
              Expanded(
                child: Text(
                  ref.t('cart.delivery'),
                  style: const TextStyle(fontSize: 13, color: K.inkMuted),
                ),
              ),
              Text(
                // Delivery for an import is arranged separately, once it has
                // landed. Quoting a fee here would invent a number weeks early.
                hasImport
                    ? ref.t('payment.deliveryNotAdded')
                    : ref.t('app.deliveryAtCheckout'),
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: K.inkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CheckoutBar extends ConsumerWidget {
  const _CheckoutBar({required this.quote});

  final AsyncValue<CartQuote> quote;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = quote.valueOrNull;
    final canCheckout = data?.canCheckout ?? false;

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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    ref.t('cart.subtotal'),
                    style: const TextStyle(fontSize: 11, color: K.inkMuted),
                  ),
                  if (data == null)
                    const Skeleton(width: 88, height: 17)
                  else
                    Text(
                      Money.format(data.subtotal.current, data.subtotal.currency),
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                    ),
                ],
              ),
              const SizedBox(width: K.s14),
              Expanded(
                child: FilledButton(
                  onPressed: canCheckout ? () => context.push('/checkout') : null,
                  child: Text(
                    ref.t('cart.checkoutShort'),
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
