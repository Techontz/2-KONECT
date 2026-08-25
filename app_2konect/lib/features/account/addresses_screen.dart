import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/account.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// The delivery address book.
///
/// One address is the default, and it is the one checkout pre-fills — which is
/// the whole point of keeping them.
class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(addressesProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('account.addresses'))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _edit(context, ref, null),
        backgroundColor: K.brand,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded, size: 19),
        label: Text(ref.t('address.add')),
      ),
      body: addresses.when(
        loading: () => const Loading(),
        error: (error, _) =>
            ErrorState(error: error, onRetry: () => ref.invalidate(addressesProvider)),
        data: (data) => data.isEmpty
            ? EmptyState(
                icon: Icons.place_outlined,
                title: ref.t('address.empty'),
                message: ref.t('address.emptyHint'),
                actionLabel: ref.t('address.add'),
                onAction: () => _edit(context, ref, null),
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 90),
                itemCount: data.length,
                separatorBuilder: (_, _) => const SizedBox(height: K.s10),
                itemBuilder: (context, index) => _AddressCard(
                  address: data[index],
                  onEdit: () => _edit(context, ref, data[index]),
                ),
              ),
      ),
    );
  }

  static Future<void> _edit(BuildContext context, WidgetRef ref, Address? address) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddressSheet(address: address),
    );
    if (saved == true) ref.invalidate(addressesProvider);
  }
}

class _AddressCard extends ConsumerWidget {
  const _AddressCard({required this.address, required this.onEdit});

  final Address address;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  address.fullName,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                ),
              ),
              if (address.isDefault) Tag(ref.t('checkout.default'), tone: Tone.brand),
            ],
          ),
          const SizedBox(height: K.s6),
          Text(
            address.formatted,
            style: const TextStyle(fontSize: 12.5, height: 1.5, color: K.inkMuted),
          ),
          const SizedBox(height: K.s4),
          Text(address.phone, style: const TextStyle(fontSize: 12.5, color: K.inkMuted)),
          const SizedBox(height: K.s10),
          Row(
            children: [
              if (!address.isDefault)
                TextButton(
                  onPressed: () => _run(context, ref, (service) => service.setDefaultAddress(address.id)),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 34),
                  ),
                  child: Text(ref.t('address.makeDefault')),
                ),
              const Spacer(),
              TextButton(
                onPressed: onEdit,
                style: TextButton.styleFrom(minimumSize: const Size(0, 34)),
                child: Text(ref.t('common.edit')),
              ),
              TextButton(
                onPressed: () => _confirmDelete(context, ref),
                style: TextButton.styleFrom(
                  foregroundColor: K.danger,
                  minimumSize: const Size(0, 34),
                ),
                child: Text(ref.t('common.remove')),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(ref.read(tProvider)('address.removeConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(ref.read(tProvider)('common.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: K.danger),
            child: Text(ref.read(tProvider)('common.remove')),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await _run(context, ref, (service) => service.deleteAddress(address.id));
  }

  static Future<void> _run(
    BuildContext context,
    WidgetRef ref,
    Future<void> Function(dynamic service) action,
  ) async {
    try {
      await action(ref.read(accountServiceProvider));
      ref.invalidate(addressesProvider);
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }
}

class _AddressSheet extends ConsumerStatefulWidget {
  const _AddressSheet({this.address});

  final Address? address;

  @override
  ConsumerState<_AddressSheet> createState() => _AddressSheetState();
}

class _AddressSheetState extends ConsumerState<_AddressSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.address?.fullName ?? '');
  late final _phone = TextEditingController(text: widget.address?.phone ?? '');
  late final _region = TextEditingController(text: widget.address?.region ?? '');
  late final _city = TextEditingController(text: widget.address?.city ?? '');
  late final _district = TextEditingController(text: widget.address?.district ?? '');
  late final _street = TextEditingController(text: widget.address?.street ?? '');
  late final _details = TextEditingController(text: widget.address?.details ?? '');
  late bool _isDefault = widget.address?.isDefault ?? false;

  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final controller in [_name, _phone, _region, _city, _district, _street, _details]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    final payload = {
      'full_name': _name.text.trim(),
      'phone': _phone.text.trim(),
      'region': _region.text.trim(),
      'city': _city.text.trim(),
      'district': _district.text.trim().isEmpty ? null : _district.text.trim(),
      'street': _street.text.trim().isEmpty ? null : _street.text.trim(),
      'details': _details.text.trim().isEmpty ? null : _details.text.trim(),
      'is_default': _isDefault,
    };

    try {
      final service = ref.read(accountServiceProvider);
      if (widget.address == null) {
        await service.createAddress(payload);
      } else {
        await service.updateAddress(widget.address!.id, payload);
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: DraggableScrollableSheet(
        initialChildSize: 0.85,
        maxChildSize: 0.94,
        expand: false,
        builder: (context, scrollController) => Form(
          key: _formKey,
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.address == null
                          ? ref.t('address.formAdd')
                          : ref.t('address.formEdit'),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: K.s8),
              _field(_name, ref.t('address.fullName'), capitalise: true),
              _field(_phone, ref.t('address.phone'), keyboard: TextInputType.phone),
              _field(_region, ref.t('address.region')),
              _field(_city, ref.t('address.city')),
              _field(_district, ref.t('address.district'), required: false),
              _field(_street, ref.t('address.street'), required: false),
              _field(_details, ref.t('address.notes'), required: false, lines: 2),
              SwitchListTile.adaptive(
                value: _isDefault,
                onChanged: (value) => setState(() => _isDefault = value),
                contentPadding: EdgeInsets.zero,
                activeThumbColor: K.brand,
                title: Text(
                  ref.t('address.makeDefault'),
                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: K.s8),
                Text(
                  _error!,
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: K.danger),
                ),
              ],
              const SizedBox(height: K.s14),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(ref.t('common.save')),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = true,
    TextInputType? keyboard,
    bool capitalise = false,
    int lines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboard,
        minLines: lines,
        maxLines: lines,
        textCapitalization:
            capitalise ? TextCapitalization.words : TextCapitalization.sentences,
        decoration: InputDecoration(
          labelText: required ? label : '$label (${ref.t('common.optional')})',
        ),
        validator: required
            ? (value) => (value ?? '').trim().isEmpty
                ? ref.read(tProvider)('common.required')
                : null
            : null,
      ),
    );
  }
}
