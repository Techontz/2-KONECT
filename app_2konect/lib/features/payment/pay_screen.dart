import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/brand.dart';
import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/order.dart';
import '../../models/payment.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// Paying for an order.
///
/// The sequence the customer follows is deliberate and each step is a separate
/// fact:
///
///   1. the order exists and is awaiting payment
///   2. here is the till number an administrator configured — copy it
///   3. pay from your own phone, outside this app
///   4. tell us the reference your phone showed you
///   5. **payment verification pending** — a human at 2KONECT checks it
///
/// Nothing on this screen marks anything paid. `POST /shop/orders/{ref}/payment`
/// moves the order to `awaiting_verification`, which is a queue, not a state of
/// settlement; only an administrator can confirm it, from the admin panel where
/// the person doing it is known and the action is recorded.
class PayScreen extends ConsumerStatefulWidget {
  const PayScreen({super.key, required this.reference});

  final String reference;

  @override
  ConsumerState<PayScreen> createState() => _PayScreenState();
}

class _PayScreenState extends ConsumerState<PayScreen> with WidgetsBindingObserver {
  final _reference = TextEditingController();

  Order? _order;
  PaymentOptions? _options;
  bool _loading = true;
  Object? _error;
  bool _submitting = false;
  String? _submitError;

  /// True while the shopper is away on the gateway's page.
  bool _awaitingReturn = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _reference.dispose();
    super.dispose();
  }

  /// Coming back from the payment page, refetch.
  ///
  /// The webhook is a separate request from the gateway to our server, racing
  /// the shopper's return — so what the order says a moment after they come
  /// back may not be what it says a moment later. This asks again; it never
  /// decides. If the webhook never arrives the order stays unpaid, correctly.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _awaitingReturn) {
      _awaitingReturn = false;
      _load();
    }
  }

  /// Hand the shopper to the gateway's own hosted page.
  ///
  /// Deliberately an external browser rather than an in-app web view: card
  /// entry belongs in the browser the person already trusts, where the address
  /// bar and the padlock are theirs to check. It is also what makes 3-D Secure
  /// work without this app having to host any of it.
  Future<void> _payByGateway() async {
    setState(() {
      _submitting = true;
      _submitError = null;
    });

    try {
      final url = await ref.read(commerceServiceProvider).createCheckoutSession(widget.reference);
      final uri = Uri.parse(url);

      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);

      if (!mounted) return;

      setState(() {
        _submitting = false;
        _awaitingReturn = launched;
        if (!launched) _submitError = ref.read(tProvider)('payment.submitFailed');
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = error.message;
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = ref.read(tProvider)('payment.submitFailed');
      });
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final commerce = ref.read(commerceServiceProvider);
      final order = await commerce.order(widget.reference);
      final options = await commerce.paymentOptions(hasImport: order.isImport);
      if (!mounted) return;
      setState(() {
        _order = order;
        _options = options;
        _loading = false;
        if (order.paymentReference != null) _reference.text = order.paymentReference!;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error;
      });
    }
  }

  Future<void> _submit() async {
    final value = _reference.text.trim();
    if (value.length < 4) {
      setState(() => _submitError = ref.read(tProvider)('payment.referenceTooShort'));
      return;
    }

    setState(() {
      _submitting = true;
      _submitError = null;
    });

    try {
      await ref.read(commerceServiceProvider).submitPaymentReference(widget.reference, value);
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.read(tProvider)('payment.statusPendingVerification'))),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = error.message;
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = ref.read(tProvider)('payment.submitFailed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(ref.t('payment.iHavePaid'))),
        body: const Loading(),
      );
    }

    if (_error != null || _order == null) {
      return Scaffold(
        appBar: AppBar(title: Text(ref.t('payment.iHavePaid'))),
        body: ErrorState(error: _error ?? 'unknown', onRetry: _load),
      );
    }

    final order = _order!;
    final channels = _options?.channels ?? const <PaymentChannel>[];

    // The channel this order was actually placed with. A cash-on-delivery
    // order has none and must never be shown a till number — falling back to
    // "whatever is switched on" would invite somebody to pay for an order that
    // is settled at the door.
    final chosen = order.paymentStatus == PaymentStatus.notRequired
        ? null
        : channels.where((channel) => channel.code == order.paymentMethod).firstOrNull ??
            (channels.length == 1 ? channels.single : null);

    return Scaffold(
      appBar: AppBar(
        title: Text(ref.t('payment.payWith', {'method': chosen?.label ?? Brand.name})),
        actions: [
          TextButton(
            onPressed: () => context.pushReplacement('/orders/${order.reference}'),
            style: TextButton.styleFrom(foregroundColor: Colors.white),
            child: Text(ref.t('orders.viewDetails')),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
        children: [
          _StatusBanner(status: order.paymentStatus, note: order.paymentNote),
          const SizedBox(height: K.s12),

          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ref.t('payment.amountToPay'),
                  style: const TextStyle(fontSize: 12, color: K.inkMuted),
                ),
                const SizedBox(height: K.s4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Text(
                        Money.format(order.total, order.currency),
                        style: const TextStyle(
                          fontSize: 27,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.6,
                          color: K.brand,
                        ),
                      ),
                    ),
                    _CopyButton(
                      value: '${order.total.round()}',
                      label: ref.t('payment.copyAmount'),
                    ),
                  ],
                ),
                const Divider(height: 22),
                Text(
                  ref.t('orders.referenceLabel', {'reference': order.reference}),
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: K.inkMuted,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: K.s12),

          if (chosen == null)
            Panel(
              color: K.warnSoft,
              border: Border.all(color: K.warn.withValues(alpha: 0.3)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline_rounded, size: 17, color: K.warn),
                  const SizedBox(width: K.s10),
                  Expanded(
                    child: Text(
                      ref.t('payment.noChannels'),
                      style: const TextStyle(
                        fontSize: 12.5,
                        height: 1.5,
                        fontWeight: FontWeight.w600,
                        color: K.warn,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            _Instructions(channel: chosen),

          // A gateway confirms itself. There is no number to copy and no
          // reference to type — the shopper goes and pays, and a signed
          // webhook settles the order. So this is a different panel, not the
          // manual one with its fields hidden.
          if (chosen != null && chosen.isGateway && order.paymentStatus.needsPayment) ...[
            const SizedBox(height: K.s12),
            if (_submitError != null) ...[
              Panel(
                color: K.dangerSoft,
                border: Border.all(color: K.danger.withValues(alpha: 0.3)),
                child: Text(
                  _submitError!,
                  style: const TextStyle(fontSize: 12.5, height: 1.5, color: K.danger),
                ),
              ),
              const SizedBox(height: K.s10),
            ],
            SizedBox(
              height: 52,
              child: FilledButton.icon(
                onPressed: _submitting ? null : _payByGateway,
                icon: _submitting
                    ? const SizedBox(
                        width: 17,
                        height: 17,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.lock_outline_rounded, size: 18),
                label: Text(
                  _submitting ? ref.t('payment.submitting') : ref.t('payment.paySecurely'),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
            ),
            const SizedBox(height: K.s10),
            Text(
              ref.t('payment.gatewayNote'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, height: 1.45, color: K.inkFaint),
            ),
          ],

          if (chosen?.isGateway != true && order.paymentStatus.needsPayment) ...[
            const SizedBox(height: K.s12),
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ref.t('payment.afterPaying'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: K.s4),
                  Text(
                    ref.t('payment.referenceHint'),
                    style: const TextStyle(fontSize: 12, height: 1.45, color: K.inkMuted),
                  ),
                  const SizedBox(height: K.s12),
                  TextField(
                    controller: _reference,
                    textCapitalization: TextCapitalization.characters,
                    decoration: InputDecoration(
                      labelText: ref.t('payment.paymentReference'),
                      hintText: ref.t('payment.referencePlaceholder'),
                      errorText: _submitError,
                    ),
                  ),
                  const SizedBox(height: K.s12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submitting ? null : _submit,
                      child: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text(ref.t('payment.iHavePaid')),
                    ),
                  ),
                  const SizedBox(height: K.s10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.shield_outlined, size: 13, color: K.inkFaint),
                      const SizedBox(width: K.s6),
                      Expanded(
                        child: Text(
                          // Set expectations honestly: sending the reference
                          // does not settle anything.
                          ref.t('payment.pendingVerificationHint'),
                          style: const TextStyle(fontSize: 11, height: 1.45, color: K.inkFaint),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: K.s14),
          Text(
            ref.t('payment.deliveryNotIncluded', {'country': Brand.country}),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, height: 1.5, color: K.inkFaint),
          ),
        ],
      ),
    );
  }
}

/// Where this order stands with money — never merged with its order status.
class _StatusBanner extends ConsumerWidget {
  const _StatusBanner({required this.status, this.note});

  final PaymentStatus status;
  final String? note;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (label, hint, colour, ground, icon) = switch (status) {
      PaymentStatus.notRequired => (
          ref.t('payment.statusOnDelivery'),
          ref.t('payment.cashOnDeliveryHint'),
          K.success,
          K.successSoft,
          Icons.payments_outlined,
        ),
      PaymentStatus.awaitingPayment => (
          ref.t('payment.statusAwaitingPayment'),
          ref.t('payment.prepaidExplainer'),
          K.warn,
          K.warnSoft,
          Icons.schedule_rounded,
        ),
      PaymentStatus.awaitingVerification => (
          ref.t('payment.statusPendingVerification'),
          ref.t('payment.pendingVerificationHint'),
          K.import,
          K.importSoft,
          Icons.hourglass_top_rounded,
        ),
      PaymentStatus.verified => (
          ref.t('payment.statusVerified'),
          ref.t('payment.verifiedHint'),
          K.success,
          K.successSoft,
          Icons.verified_rounded,
        ),
      PaymentStatus.rejected => (
          ref.t('payment.statusRejected'),
          ref.t('payment.rejectedHint'),
          K.danger,
          K.dangerSoft,
          Icons.error_outline_rounded,
        ),
    };

    return Panel(
      color: ground,
      border: Border.all(color: colour.withValues(alpha: 0.25)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 19, color: colour),
          const SizedBox(width: K.s12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: colour),
                ),
                const SizedBox(height: K.s4),
                Text(
                  note ?? hint,
                  style: const TextStyle(fontSize: 12, height: 1.5, color: K.inkSoft),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The till number and what to do with it — read entirely from the server.
class _Instructions extends ConsumerWidget {
  const _Instructions({required this.channel});

  final PaymentChannel channel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(channel.label, style: Theme.of(context).textTheme.titleMedium),
          if (channel.merchantName != null && channel.merchantName!.isNotEmpty) ...[
            const SizedBox(height: K.s4),
            Text(
              channel.merchantName!,
              style: const TextStyle(fontSize: 12.5, color: K.inkMuted),
            ),
          ],
          if (channel.number != null && channel.number!.isNotEmpty) ...[
            const SizedBox(height: K.s12),
            Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
              decoration: BoxDecoration(
                color: K.brand50,
                borderRadius: K.radius(K.rSm),
                border: Border.all(color: K.brand200),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          ref.t('payment.lipaNamba'),
                          style: const TextStyle(fontSize: 11, color: K.inkMuted),
                        ),
                        const SizedBox(height: K.s2),
                        SelectableText(
                          channel.number!,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                            color: K.brand,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _CopyButton(
                    value: channel.number!,
                    label: ref.t('payment.copyNumber'),
                    prominent: true,
                  ),
                ],
              ),
            ),
          ],
          if (channel.instructions != null && channel.instructions!.isNotEmpty) ...[
            const SizedBox(height: K.s12),
            Text(
              channel.instructions!,
              style: const TextStyle(fontSize: 12.5, height: 1.6, color: K.inkSoft),
            ),
          ],
        ],
      ),
    );
  }
}

class _CopyButton extends ConsumerStatefulWidget {
  const _CopyButton({required this.value, required this.label, this.prominent = false});

  final String value;
  final String label;
  final bool prominent;

  @override
  ConsumerState<_CopyButton> createState() => _CopyButtonState();
}

class _CopyButtonState extends ConsumerState<_CopyButton> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.value));
    if (!mounted) return;
    setState(() => _copied = true);
    Future<void>.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final label = _copied ? ref.t('payment.copied') : widget.label;

    if (widget.prominent) {
      return TextButton.icon(
        onPressed: _copy,
        icon: Icon(_copied ? Icons.check_rounded : Icons.copy_rounded, size: 16),
        label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        style: TextButton.styleFrom(
          foregroundColor: _copied ? K.success : K.brand,
          minimumSize: const Size(0, 44),
        ),
      );
    }

    return IconButton(
      tooltip: label,
      onPressed: _copy,
      icon: Icon(
        _copied ? Icons.check_rounded : Icons.copy_rounded,
        size: 18,
        color: _copied ? K.success : K.inkMuted,
      ),
    );
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
