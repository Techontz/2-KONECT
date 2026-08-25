import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/order.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../providers/session.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// Arranging the last mile — 2KONECT Rides.
///
/// Deliberately a separate step from paying for the goods. What arrives from
/// abroad is not on a courier's van the day it is bought: it is sourced,
/// freighted and cleared first, and only once it has landed does anyone know
/// what moving it the last mile costs. So the fee shown here is the one the
/// server quotes for the chosen mode, never a figure this screen invents.
class RequestDeliveryScreen extends ConsumerStatefulWidget {
  const RequestDeliveryScreen({super.key, required this.orderReference});

  final String orderReference;

  @override
  ConsumerState<RequestDeliveryScreen> createState() => _RequestDeliveryScreenState();
}

class _RequestDeliveryScreenState extends ConsumerState<RequestDeliveryScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _notes = TextEditingController();

  DeliveryMode _mode = DeliveryMode.delivery;
  String? _pickupPoint;
  String? _window;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(currentUserProvider);
    if (user != null) {
      _name.text = user.name;
      if (user.phone != null) _phone.text = user.phone!;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit(DeliveryOptions options) async {
    if (!_formKey.currentState!.validate()) return;
    if (_mode == DeliveryMode.pickup && _pickupPoint == null) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await ref.read(commerceServiceProvider).requestDelivery(
            orderReference: widget.orderReference,
            mode: _mode,
            recipientName: _name.text.trim(),
            recipientPhone: _phone.text.trim(),
            address: _mode == DeliveryMode.delivery ? _address.text.trim() : null,
            pickupPoint: _mode == DeliveryMode.pickup ? _pickupPoint : null,
            preferredWindow: _window,
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          );

      ref.invalidate(orderProvider(widget.orderReference));
      ref.invalidate(deliveriesProvider);
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = error.message;
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = ref.read(tProvider)('delivery.arrangeFailed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final options = ref.watch(deliveryOptionsProvider(widget.orderReference));

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('delivery.arrangeDelivery'))),
      body: options.when(
        loading: () => const Loading(),
        error: (error, _) => ErrorState(
          error: error,
          onRetry: () => ref.invalidate(deliveryOptionsProvider(widget.orderReference)),
        ),
        data: (data) {
          if (!data.available) {
            return EmptyState(
              icon: Icons.schedule_rounded,
              title: ref.t('delivery.notThereYet'),
              message: ref.t('orders.arrivedInCountry', {'country': 'Tanzania'}),
            );
          }

          final selected = data.modes.where((m) => m.value == _mode).firstOrNull;

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
              children: [
                Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ref.t('delivery.howDoYouWantIt'),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: K.s12),
                      for (final mode in data.modes)
                        _ModeRow(
                          mode: mode,
                          selected: _mode == mode.value,
                          onTap: () => setState(() => _mode = mode.value),
                        ),
                    ],
                  ),
                ),

                const SizedBox(height: K.s12),
                Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ref.t('delivery.whoReceiving'),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: K.s12),
                      TextFormField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        decoration: InputDecoration(labelText: ref.t('delivery.fullName')),
                        validator: (value) => (value ?? '').trim().length < 2
                            ? ref.read(tProvider)('common.required')
                            : null,
                      ),
                      const SizedBox(height: K.s12),
                      TextFormField(
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(labelText: ref.t('delivery.phone')),
                        validator: (value) => (value ?? '').trim().length < 9
                            ? ref.read(tProvider)('common.required')
                            : null,
                      ),

                      if (_mode == DeliveryMode.delivery) ...[
                        const SizedBox(height: K.s12),
                        TextFormField(
                          controller: _address,
                          minLines: 2,
                          maxLines: 3,
                          decoration: InputDecoration(
                            labelText: ref.t('delivery.deliveryAddress'),
                            hintText: ref.t('delivery.addressPlaceholder'),
                            alignLabelWithHint: true,
                          ),
                          validator: (value) => (value ?? '').trim().length < 6
                              ? ref.read(tProvider)('common.required')
                              : null,
                        ),
                      ] else if (data.pickupPoints.isNotEmpty) ...[
                        const SizedBox(height: K.s12),
                        DropdownButtonFormField<String>(
                          initialValue: _pickupPoint,
                          isExpanded: true,
                          decoration:
                              InputDecoration(labelText: ref.t('delivery.collectFrom')),
                          items: [
                            for (final point in data.pickupPoints)
                              DropdownMenuItem(
                                value: point.id,
                                child: Text(
                                  '${point.name} — ${point.address}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                          ],
                          onChanged: (value) => setState(() => _pickupPoint = value),
                          validator: (value) => value == null
                              ? ref.read(tProvider)('common.required')
                              : null,
                        ),
                      ],

                      if (data.windows.isNotEmpty) ...[
                        const SizedBox(height: K.s12),
                        DropdownButtonFormField<String>(
                          initialValue: _window,
                          isExpanded: true,
                          decoration: InputDecoration(labelText: ref.t('delivery.time')),
                          items: [
                            for (final window in data.windows)
                              DropdownMenuItem(
                                value: window,
                                child: Text(window, style: const TextStyle(fontSize: 13)),
                              ),
                          ],
                          onChanged: (value) => setState(() => _window = value),
                        ),
                      ],

                      const SizedBox(height: K.s12),
                      TextFormField(
                        controller: _notes,
                        minLines: 2,
                        maxLines: 3,
                        decoration: InputDecoration(
                          labelText: ref.t('delivery.anythingElse'),
                          hintText: ref.t('delivery.anythingElsePlaceholder'),
                          alignLabelWithHint: true,
                        ),
                      ),
                    ],
                  ),
                ),

                if (_error != null) ...[
                  const SizedBox(height: K.s12),
                  Text(
                    _error!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: K.danger,
                    ),
                  ),
                ],

                const SizedBox(height: K.gutter),
                if (selected != null)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          ref.t('delivery.deliveryFee'),
                          style: const TextStyle(fontSize: 13, color: K.inkMuted),
                        ),
                      ),
                      Text(
                        // The server's quote for this mode. Zero here means
                        // the mode genuinely carries no fee, which for a
                        // collection is the ordinary case.
                        Money.format(selected.fee),
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                const SizedBox(height: K.s12),
                FilledButton(
                  onPressed: _submitting ? null : () => _submit(data),
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(ref.t('delivery.confirm')),
                ),
                const SizedBox(height: K.s8),
                Text(
                  ref.t('orders.confirmTime'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 11, color: K.inkFaint),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ModeRow extends StatelessWidget {
  const _ModeRow({required this.mode, required this.selected, required this.onTap});

  final DeliveryModeOption mode;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: selected ? K.brand50 : K.surface,
        borderRadius: K.radius(K.rSm),
        child: InkWell(
          onTap: onTap,
          borderRadius: K.radius(K.rSm),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: K.radius(K.rSm),
              border: Border.all(
                color: selected ? K.brand : K.line,
                width: selected ? 1.5 : 1,
              ),
            ),
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(
                  selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                  size: 19,
                  color: selected ? K.brand : K.lineStrong,
                ),
                const SizedBox(width: K.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        mode.label,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: selected ? K.brand : K.ink,
                        ),
                      ),
                      const SizedBox(height: K.s2),
                      Text(
                        mode.note,
                        style: const TextStyle(fontSize: 11.5, height: 1.4, color: K.inkMuted),
                      ),
                    ],
                  ),
                ),
                Text(
                  Money.format(mode.fee),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),
        ),
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
