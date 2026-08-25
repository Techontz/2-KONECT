import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/account.dart';
import '../../models/cart.dart';
import '../../models/payment.dart';
import '../../providers/cart.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/session.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';
import 'widgets/payment_picker.dart';

/// Checkout.
///
/// The one screen where 2KONECT's central business rule becomes visible:
///
///   * A basket that is entirely local may be paid on delivery, and its
///     delivery fee is knowable now.
///   * A basket holding **anything** sourced from abroad is prepaid. Cash on
///     delivery is not shown, not disabled-but-present, not hidden behind a
///     tooltip — it is not in the list, because the server will not accept it.
///   * Delivery for an import is arranged separately after it lands, so no fee
///     is added here.
///
/// None of that is decided in this file. `GET /shop/payment-channels` reports
/// it, `App\Support\CheckoutPolicy` decides it, and the same rule is applied
/// again against the real products when the order is posted — so a client that
/// lied about its basket gets a refusal rather than cash on delivery.
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _address = TextEditingController();
  final _phone = TextEditingController();

  PaymentOptions? _options;
  String? _method;
  Address? _savedAddress;

  bool _loading = true;
  Object? _loadError;
  bool _placing = false;
  String? _submitError;

  @override
  void initState() {
    super.initState();
    _prefill();
    _loadOptions();
  }

  @override
  void dispose() {
    _address.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _prefill() {
    final user = ref.read(currentUserProvider);
    if (user?.phone != null) _phone.text = user!.phone!;
  }

  /// The channels this basket may use, and whether a delivery fee belongs here.
  Future<void> _loadOptions() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });

    final hasImport = ref.read(cartHasImportProvider);

    try {
      final options =
          await ref.read(commerceServiceProvider).paymentOptions(hasImport: hasImport);
      final addresses = await _addresses();
      if (!mounted) return;

      setState(() {
        _options = options;
        _loading = false;
        // Pre-select only when there is exactly one honest answer.
        _method = _defaultMethod(options);
        _savedAddress = addresses;
        if (addresses != null) {
          _address.text = addresses.formatted;
          if (_phone.text.isEmpty) _phone.text = addresses.phone;
        }
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = error;
      });
    }
  }

  Future<Address?> _addresses() async {
    try {
      final list = await ref.read(accountServiceProvider).addresses();
      if (list.isEmpty) return null;
      return list.firstWhere((a) => a.isDefault, orElse: () => list.first);
    } on ApiException {
      // An address book that cannot be read is not a reason to block checkout —
      // the field is typed instead.
      return null;
    }
  }

  static String? _defaultMethod(PaymentOptions options) {
    if (options.cashOnDelivery && options.channels.isEmpty) {
      return PaymentChannel.cashOnDelivery;
    }
    if (options.channels.length == 1 && !options.cashOnDelivery) {
      return options.channels.first.code;
    }
    return null;
  }

  Future<void> _placeOrder() async {
    if (!_formKey.currentState!.validate()) return;
    final method = _method;
    if (method == null) return;

    final lines = ref.read(cartProvider);
    if (lines.isEmpty) return;

    setState(() {
      _placing = true;
      _submitError = null;
    });

    try {
      final order = await ref.read(commerceServiceProvider).placeOrder(
            lines: lines,
            deliveryAddress: _address.text.trim(),
            customerPhone: _phone.text.trim(),
            paymentMethod: method,
          );

      ref.read(cartProvider.notifier).clear();
      if (!mounted) return;

      // A prepaid order goes straight to the payment instructions — there is
      // nothing useful the customer can do until they have sent the money.
      if (order.paymentStatus.needsPayment) {
        context.pushReplacement('/pay/${order.reference}');
      } else {
        context.pushReplacement('/orders/${order.reference}');
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _placing = false;
        // The server's refusal, verbatim — including the cash-on-delivery
        // rule, which it states better than a generic failure would.
        _submitError = error.message;
      });
      // A refused method means our picture of the basket is stale; re-read it.
      if (error.failure == ApiFailure.invalid) _loadOptions();
    } on Object {
      if (!mounted) return;
      setState(() {
        _placing = false;
        _submitError = ref.read(tProvider)('checkout.failed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final lines = ref.watch(cartProvider);
    final quote = ref.watch(cartQuoteProvider);
    final hasImport = ref.watch(cartHasImportProvider);

    if (lines.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: Text(ref.t('checkout.title'))),
        body: EmptyState(
          icon: Icons.shopping_cart_outlined,
          title: ref.t('checkout.nothingToCheckout'),
          message: ref.t('checkout.cartEmpty'),
          actionLabel: ref.t('checkout.browseProducts'),
          onAction: () => context.go('/shop'),
        ),
      );
    }

    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(ref.t('checkout.title'))),
        body: const Loading(),
      );
    }

    if (_loadError != null) {
      return Scaffold(
        appBar: AppBar(title: Text(ref.t('checkout.title'))),
        body: ErrorState(error: _loadError!, onRetry: _loadOptions),
      );
    }

    final options = _options!;

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('checkout.title'))),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
          children: [
            if (hasImport) ...[
              _ImportNotice(),
              const SizedBox(height: K.s12),
            ],

            _Section(
              title: ref.t('checkout.deliveryDetails'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_savedAddress != null) ...[
                    Row(
                      children: [
                        const Icon(Icons.place_outlined, size: 15, color: K.brand),
                        const SizedBox(width: K.s6),
                        Expanded(
                          child: Text(
                            ref.t('checkout.deliverTo'),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: K.brand,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () => context.push('/addresses'),
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(0, 30),
                          ),
                          child: Text(ref.t('checkout.manageAddresses')),
                        ),
                      ],
                    ),
                    const SizedBox(height: K.s6),
                  ],
                  TextFormField(
                    controller: _address,
                    minLines: 2,
                    maxLines: 4,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(
                      labelText: ref.t('checkout.deliveryAddress'),
                      hintText: ref.t('checkout.addressPlaceholder'),
                      alignLabelWithHint: true,
                    ),
                    validator: (value) => (value ?? '').trim().length < 6
                        ? ref.read(tProvider)('common.required')
                        : null,
                  ),
                  const SizedBox(height: K.s12),
                  TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: ref.t('checkout.phone'),
                      hintText: ref.t('checkout.phonePlaceholder'),
                    ),
                    validator: (value) => (value ?? '').trim().length < 9
                        ? ref.read(tProvider)('common.required')
                        : null,
                  ),
                ],
              ),
            ),

            const SizedBox(height: K.s12),

            _Section(
              title: ref.t('checkout.payment'),
              child: PaymentPicker(
                options: options,
                selected: _method,
                onSelect: (code) => setState(() => _method = code),
              ),
            ),

            const SizedBox(height: K.s12),
            _OrderSummary(lines: lines, quote: quote, options: options),

            if (_submitError != null) ...[
              const SizedBox(height: K.s12),
              Panel(
                color: K.dangerSoft,
                border: Border.all(color: K.danger.withValues(alpha: 0.25)),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline_rounded, size: 17, color: K.danger),
                    const SizedBox(width: K.s10),
                    Expanded(
                      child: Text(
                        _submitError!,
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.45,
                          fontWeight: FontWeight.w600,
                          color: K.danger,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: K.s14),
            Text(
              ref.t('checkout.terms', {'brand': Brand.name}),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, height: 1.5, color: K.inkFaint),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _PlaceBar(
        quote: quote,
        // No method chosen — or, for a prepaid basket with nothing switched
        // on, no method to choose — means no order.
        enabled: _method != null && !_placing && !options.hasNoWayToPay,
        placing: _placing,
        onPlace: _placeOrder,
      ),
    );
  }
}

class _ImportNotice extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      color: K.importSoft,
      border: Border.all(color: K.importLine),
      padding: const EdgeInsets.all(13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.flight_takeoff_rounded, size: 17, color: K.import),
              const SizedBox(width: K.s8),
              Expanded(
                child: Text(
                  ref.t('checkout.weImportIt'),
                  style: const TextStyle(
                    fontSize: 12.5,
                    height: 1.4,
                    fontWeight: FontWeight.w700,
                    color: K.import,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: K.s8),
          Text(
            ref.t('payment.prepaidExplainer'),
            style: const TextStyle(fontSize: 12, height: 1.5, color: K.inkSoft),
          ),
          const SizedBox(height: K.s6),
          Text(
            ref.t('payment.deliveryNotIncluded', {'country': Brand.country}),
            style: const TextStyle(fontSize: 11.5, height: 1.45, color: K.inkMuted),
          ),
        ],
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
            const SizedBox(height: K.s12),
            child,
          ],
        ),
      );
}

class _OrderSummary extends ConsumerWidget {
  const _OrderSummary({
    required this.lines,
    required this.quote,
    required this.options,
  });

  final List<CartLine> lines;
  final AsyncValue<CartQuote> quote;
  final PaymentOptions options;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = lines.fold<int>(0, (sum, line) => sum + line.quantity);
    final subtotal = quote.valueOrNull?.subtotal;

    return _Section(
      title: ref.t('checkout.summary'),
      child: Column(
        children: [
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.only(bottom: 9),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: K.radius(K.rXs),
                      border: K.hairline,
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: ProductImage(
                      url: line.product.image,
                      padding: const EdgeInsets.all(3),
                      decodeWidth: 90,
                    ),
                  ),
                  const SizedBox(width: K.s10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          line.product.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                        ),
                        Text(
                          '${ref.t('checkout.qty', {'count': line.quantity})} · ${line.sourcing.label}',
                          style: const TextStyle(fontSize: 11, color: K.inkFaint),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    Money.format(
                      quote.valueOrNull?.lineFor(line)?.total.current ??
                          (line.option?.price.current ?? line.product.price.current) *
                              line.quantity,
                    ),
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          const Divider(height: 20),
          _Line(
            label: count == 1
                ? ref.t('cart.subtotalItemOne')
                : ref.t('cart.subtotalItems', {'count': count}),
            value: subtotal == null ? null : Money.format(subtotal.current, subtotal.currency),
          ),
          const SizedBox(height: K.s8),
          _Line(
            label: ref.t('checkout.delivery'),
            // Never invents a figure. A local order is charged the flat fee by
            // the server when it is placed; an import has its delivery
            // arranged separately once it has landed.
            valueText: options.chargesDelivery
                ? ref.t('app.deliveryAtCheckout')
                : ref.t('payment.deliveryNotAdded'),
          ),
          const Divider(height: 20),
          Row(
            children: [
              Expanded(
                child: Text(
                  ref.t('checkout.total'),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                ),
              ),
              if (subtotal == null)
                const Skeleton(width: 90, height: 17)
              else
                Text(
                  Money.format(subtotal.current, subtotal.currency),
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: K.brand),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, this.value, this.valueText});

  final String label;
  final String? value;
  final String? valueText;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(label, style: const TextStyle(fontSize: 12.5, color: K.inkMuted)),
        ),
        if (value != null)
          Text(value!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))
        else if (valueText != null)
          Text(
            valueText!,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: K.inkMuted),
          )
        else
          const Skeleton(width: 70, height: 13),
      ],
    );
  }
}

class _PlaceBar extends ConsumerWidget {
  const _PlaceBar({
    required this.quote,
    required this.enabled,
    required this.placing,
    required this.onPlace,
  });

  final AsyncValue<CartQuote> quote;
  final bool enabled;
  final bool placing;
  final VoidCallback onPlace;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subtotal = quote.valueOrNull?.subtotal;

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
                    ref.t('checkout.total'),
                    style: const TextStyle(fontSize: 11, color: K.inkMuted),
                  ),
                  Text(
                    subtotal == null ? '—' : Money.format(subtotal.current, subtotal.currency),
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
              const SizedBox(width: K.s14),
              Expanded(
                child: FilledButton(
                  onPressed: enabled ? onPlace : null,
                  child: placing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          ref.t('checkout.placeOrder'),
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
