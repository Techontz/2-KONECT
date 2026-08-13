import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../data/remote_shop_source.dart';
import '../../domain/models/commerce.dart';
import '../../state/app_controllers.dart';
import '../../state/auth_controller.dart';
import '../../widgets/async_state.dart';
import '../../widgets/states.dart';
import '../onboarding/location_picker_screen.dart';

/// The account's delivery addresses.
///
/// Every operation goes to the backend's `addresses` table — the same records
/// the website reads and writes. There is no local address book, and no second
/// address model.
///
/// [selectionMode] turns the screen into a picker for checkout: tapping a row
/// returns it instead of opening the editor.
class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key, this.selectionMode = false});

  final bool selectionMode;

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() => context.read<LocationController>().loadAddresses();

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final location = context.watch<LocationController>();
    final signedIn = context.watch<AuthController>().isAuthenticated;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(title: Text(strings.addresses)),
      floatingActionButton: signedIn
          ? FloatingActionButton.extended(
              onPressed: () => _openEditor(),
              backgroundColor: AppColors.brandBlack,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_location_alt_outlined, size: 19),
              label: Text(strings.addAddress),
            )
          : null,
      body: !signedIn
          ? EmptyState(
              title: strings.signInToContinue,
              message: strings.noAddresses,
              icon: Icons.lock_outline,
            )
          : _body(strings, location),
    );
  }

  Widget _body(AppStrings strings, LocationController location) {
    if (location.loadingAddresses && location.savedAddresses.isEmpty) {
      return const LoadingState();
    }

    if (location.addressError != null && location.savedAddresses.isEmpty) {
      return ErrorState(
        message: '${location.addressError}',
        onRetry: _load,
      );
    }

    if (location.savedAddresses.isEmpty) {
      return EmptyState(
        title: strings.noAddresses,
        message: strings.deliverTo,
        icon: Icons.location_off_outlined,
        action: FilledButton(
          onPressed: () => _openEditor(),
          child: Text(strings.addAddress),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
            AppSpacing.gutter, AppSpacing.gutter, AppSpacing.gutter, 96),
        itemCount: location.savedAddresses.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final address = location.savedAddresses[index];
          return _AddressCard(
            address: address,
            selectionMode: widget.selectionMode,
            onTap: () => widget.selectionMode
                ? Navigator.of(context).pop(address)
                : _openEditor(address),
            onEdit: () => _openEditor(address),
            onDelete: () => _confirmDelete(address),
            onMakeDefault: address.isDefault
                ? null
                : () => _run(() => location.makeDefault(address.id)),
          );
        },
      ),
    );
  }

  Future<void> _openEditor([Address? address]) async {
    final saved = await Navigator.of(context).push<Address>(
      MaterialPageRoute(builder: (_) => AddressEditorScreen(existing: address)),
    );
    if (saved != null && mounted && widget.selectionMode) {
      Navigator.of(context).pop(saved);
    }
  }

  Future<void> _confirmDelete(Address address) async {
    final strings = context.strings;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(strings.remove),
        content: Text(address.summary),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(strings.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(strings.remove),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await _run(() =>
          context.read<LocationController>().removeAddress(address.id));
    }
  }

  /// Runs a backend mutation and reports its failure rather than silently
  /// leaving the list looking changed.
  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    }
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.address,
    required this.selectionMode,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
    this.onMakeDefault,
  });

  final Address address;
  final bool selectionMode;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback? onMakeDefault;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: address.isDefault ? AppColors.primary : AppColors.divider,
            width: address.isDefault ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    address.fullName ?? address.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.bodyStrong,
                  ),
                ),
                if (address.isDefault)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      strings.deliverHere,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(address.summary, style: AppTypography.metaMuted),
            if (address.phone != null) ...[
              const SizedBox(height: 2),
              Text(address.phone!, style: AppTypography.metaMuted),
            ],
            if (address.hasPin)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(
                  children: [
                    const Icon(Icons.place, size: 13, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Text(
                      '${address.latitude!.toStringAsFixed(4)}, '
                      '${address.longitude!.toStringAsFixed(4)}',
                      style: AppTypography.metaMuted,
                    ),
                  ],
                ),
              ),
            if (!selectionMode) ...[
              const Divider(height: 20),
              Row(
                children: [
                  if (onMakeDefault != null)
                    TextButton(
                      onPressed: onMakeDefault,
                      child: Text(strings.deliverHere),
                    ),
                  const Spacer(),
                  IconButton(
                    onPressed: onEdit,
                    icon: const Icon(Icons.edit_outlined, size: 19),
                    tooltip: strings.save,
                  ),
                  IconButton(
                    onPressed: onDelete,
                    icon: const Icon(Icons.delete_outline,
                        size: 19, color: Color(0xFFD3302F)),
                    tooltip: strings.remove,
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Add or edit one address.
class AddressEditorScreen extends StatefulWidget {
  const AddressEditorScreen({super.key, this.existing});

  final Address? existing;

  @override
  State<AddressEditorScreen> createState() => _AddressEditorScreenState();
}

class _AddressEditorScreenState extends State<AddressEditorScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _name =
      TextEditingController(text: widget.existing?.fullName ?? '');
  late final TextEditingController _phone =
      TextEditingController(text: widget.existing?.phone ?? '');
  late final TextEditingController _city =
      TextEditingController(text: widget.existing?.city ?? 'Dar es Salaam');
  late final TextEditingController _district =
      TextEditingController(text: widget.existing?.district ?? '');
  late final TextEditingController _street =
      TextEditingController(text: widget.existing?.line1 ?? '');
  late final TextEditingController _details =
      TextEditingController(text: widget.existing?.details ?? '');

  late bool _isDefault = widget.existing?.isDefault ?? false;
  late double? _latitude = widget.existing?.latitude;
  late double? _longitude = widget.existing?.longitude;

  bool _saving = false;

  @override
  void dispose() {
    for (final c in [_name, _phone, _city, _district, _street, _details]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickOnMap() async {
    final picked = await Navigator.of(context).push<PickedPlace>(
      MaterialPageRoute(
        builder: (_) => LocationPickerScreen(
          initialLatitude: _latitude,
          initialLongitude: _longitude,
        ),
      ),
    );

    if (picked == null || !mounted) return;

    setState(() {
      _latitude = picked.latitude;
      _longitude = picked.longitude;
      if (picked.area != null && picked.area!.isNotEmpty) {
        _district.text = picked.area!;
      }
      if (picked.city != null && picked.city!.isNotEmpty) {
        _city.text = picked.city!;
      }
      if (picked.street != null && picked.street!.isNotEmpty) {
        _street.text = picked.street!;
      }
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate() || _saving) return;
    setState(() => _saving = true);

    final draft = AddressDraft(
      fullName: _name.text.trim(),
      phone: _phone.text.trim(),
      city: _city.text.trim(),
      district: _district.text.trim(),
      street: _street.text.trim(),
      details: _details.text.trim(),
      latitude: _latitude,
      longitude: _longitude,
      isDefault: _isDefault,
    );

    try {
      final saved = await context
          .read<LocationController>()
          .saveAddress(draft, id: widget.existing?.id);
      if (mounted) Navigator.of(context).pop(saved);
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      // The backend validates; its message is shown rather than a generic one.
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$error')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(
        title: Text(widget.existing == null ? strings.addAddress : strings.save),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.gutter),
          children: [
            _field(_name, 'Full name', required: true),
            _field(_phone, 'Phone', required: true, keyboard: TextInputType.phone),
            _field(_city, 'City', required: true),
            _field(_district, 'District / area'),
            _field(_street, 'Street'),
            _field(_details, 'Extra directions (shop number, landmark)'),

            const SizedBox(height: 6),
            OutlinedButton.icon(
              onPressed: _pickOnMap,
              icon: const Icon(Icons.map_outlined, size: 18),
              label: Text(
                _latitude == null
                    ? strings.searchYourLocation
                    : '${_latitude!.toStringAsFixed(4)}, '
                        '${_longitude!.toStringAsFixed(4)}',
              ),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
            ),

            const SizedBox(height: 6),
            SwitchListTile.adaptive(
              value: _isDefault,
              onChanged: (value) => setState(() => _isDefault = value),
              title: Text(strings.deliverHere, style: AppTypography.body),
              contentPadding: EdgeInsets.zero,
            ),

            const SizedBox(height: 12),
            PrimaryButton(
              label: _saving ? '…' : strings.save,
              expand: true,
              height: 52,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    TextInputType? keyboard,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboard,
        textCapitalization: TextCapitalization.words,
        decoration: InputDecoration(
          labelText: required ? '$label *' : label,
          filled: true,
          fillColor: AppColors.surface,
          border: const OutlineInputBorder(),
        ),
        validator: (value) {
          if (!required) return null;
          return (value == null || value.trim().isEmpty) ? 'Required' : null;
        },
      ),
    );
  }
}
