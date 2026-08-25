import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/brand.dart';
import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../providers/session.dart';
import '../../widgets/primitives.dart';

/// "Tell us what you need. We'll find it."
///
/// 2KONECT's sourcing service, and the single most distinctive thing it does.
/// Open to signed-out visitors on purpose — somebody who cannot find what they
/// need should not have to register before telling us what it is — and sent as
/// multipart, because a photo is usually the clearest description there is.
class RequestFormScreen extends ConsumerStatefulWidget {
  const RequestFormScreen({super.key, this.prefillTerm});

  final String? prefillTerm;

  @override
  ConsumerState<RequestFormScreen> createState() => _RequestFormScreenState();
}

class _RequestFormScreenState extends ConsumerState<RequestFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.prefillTerm ?? '');
  final _description = TextEditingController();
  final _brand = TextEditingController();
  final _budget = TextEditingController();
  final _quantity = TextEditingController(text: '1');
  final _contactName = TextEditingController();
  final _contactPhone = TextEditingController();
  final _contactEmail = TextEditingController();
  final _city = TextEditingController();

  String _urgency = 'standard';
  File? _photo;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(currentUserProvider);
    if (user != null) {
      _contactName.text = user.name;
      _contactEmail.text = user.email;
      if (user.phone != null) _contactPhone.text = user.phone!;
    }
  }

  @override
  void dispose() {
    for (final controller in [
      _name,
      _description,
      _brand,
      _budget,
      _quantity,
      _contactName,
      _contactPhone,
      _contactEmail,
      _city,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      // Sourcing needs a recognisable photograph, not a 12-megapixel original
      // uploaded over a Tanzanian mobile connection.
      maxWidth: 1600,
      imageQuality: 82,
    );
    if (picked != null && mounted) setState(() => _photo = File(picked.path));
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final request = await ref.read(accountServiceProvider).requestProduct(
            name: _name.text.trim(),
            quantity: int.tryParse(_quantity.text.trim()) ?? 1,
            contactName: _contactName.text.trim(),
            contactPhone: _contactPhone.text.trim(),
            description: _description.text.trim(),
            brand: _brand.text.trim(),
            urgency: _urgency,
            // A plain number. What the customer typed is parsed before it ever
            // reaches the API.
            budgetMax: Money.parse(_budget.text),
            contactEmail: _contactEmail.text.trim(),
            deliveryCity: _city.text.trim(),
            image: _photo,
          );

      ref.invalidate(myRequestsProvider);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(ref.read(tProvider)('request.received')),
          content: Text(
            '${ref.read(tProvider)('request.receivedBodyEnd')}\n\n'
            '${ref.read(tProvider)('request.yourReference')}: ${request.reference}',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(ref.read(tProvider)('request.keepShopping')),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/requests');
              },
              child: Text(ref.read(tProvider)('request.checkRequests')),
            ),
          ],
        ),
      );
      if (mounted) Navigator.of(context).maybePop();
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
        _error = ref.read(tProvider)('common.somethingWrong');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(ref.t('nav.requestProduct'))),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
          children: [
            Panel(
              color: K.brand,
              border: Border.all(color: K.brand),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Tag(ref.t('request.eyebrow'), tone: Tone.brand),
                  const SizedBox(height: K.s10),
                  Text(
                    ref.t('request.heroTitle'),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: K.s6),
                  Text(
                    ref.t('request.heroBody', {'country': Brand.country}),
                    style: const TextStyle(fontSize: 12.5, height: 1.5, color: K.brand300),
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
                    ref.t('request.describeNeed'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: K.s12),
                  TextFormField(
                    controller: _name,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(labelText: ref.t('request.whatIsIt')),
                    validator: (value) => (value ?? '').trim().length < 2
                        ? ref.read(tProvider)('common.required')
                        : null,
                  ),
                  const SizedBox(height: K.s12),
                  TextFormField(
                    controller: _description,
                    minLines: 3,
                    maxLines: 5,
                    decoration: InputDecoration(
                      labelText: ref.t('request.describeNeed'),
                      hintText: ref.t('request.describePlaceholder'),
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: K.s12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _brand,
                          decoration:
                              InputDecoration(labelText: ref.t('request.brandOptional')),
                        ),
                      ),
                      const SizedBox(width: K.s10),
                      SizedBox(
                        width: 92,
                        child: TextFormField(
                          controller: _quantity,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(labelText: ref.t('cart.quantity')),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: K.s12),
                  TextFormField(
                    controller: _budget,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: ref.t('request.budgetOptional'),
                      prefixText: 'TZS  ',
                    ),
                  ),
                  const SizedBox(height: K.s12),
                  _PhotoPicker(
                    photo: _photo,
                    onPick: _pickPhoto,
                    onClear: () => setState(() => _photo = null),
                  ),
                  const SizedBox(height: K.s14),
                  Text(
                    ref.t('request.howSoon'),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: K.s8),
                  Wrap(
                    spacing: 7,
                    children: [
                      for (final option in const [
                        ('standard', 'request.noRush'),
                        ('soon', 'request.soon'),
                        ('urgent', 'request.urgent'),
                      ])
                        ChoiceChip(
                          label: Text(ref.t(option.$2)),
                          selected: _urgency == option.$1,
                          onSelected: (_) => setState(() => _urgency = option.$1),
                          selectedColor: K.brand,
                          labelStyle: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: _urgency == option.$1 ? Colors.white : K.inkSoft,
                          ),
                        ),
                    ],
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
                    ref.t('request.howReachYou'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: K.s4),
                  Text(
                    ref.t('request.howReachYouHint'),
                    style: const TextStyle(fontSize: 12, height: 1.45, color: K.inkMuted),
                  ),
                  const SizedBox(height: K.s12),
                  TextFormField(
                    controller: _contactName,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(labelText: ref.t('request.fullName')),
                    validator: (value) => (value ?? '').trim().length < 2
                        ? ref.read(tProvider)('common.required')
                        : null,
                  ),
                  const SizedBox(height: K.s12),
                  TextFormField(
                    controller: _contactPhone,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: ref.t('checkout.phone'),
                      hintText: ref.t('checkout.phonePlaceholder'),
                    ),
                    validator: (value) => (value ?? '').trim().length < 9
                        ? ref.read(tProvider)('common.required')
                        : null,
                  ),
                  const SizedBox(height: K.s12),
                  TextFormField(
                    controller: _contactEmail,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(labelText: ref.t('request.emailOptional')),
                  ),
                  const SizedBox(height: K.s12),
                  TextFormField(
                    controller: _city,
                    decoration: InputDecoration(labelText: ref.t('request.deliverTo')),
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
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(ref.t('request.submit')),
            ),
            const SizedBox(height: K.s10),
            Text(
              ref.t('request.noPaymentNow'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, height: 1.5, color: K.inkFaint),
            ),
          ],
        ),
      ),
    );
  }
}

class _PhotoPicker extends ConsumerWidget {
  const _PhotoPicker({required this.photo, required this.onPick, required this.onClear});

  final File? photo;
  final VoidCallback onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (photo == null) {
      return OutlinedButton.icon(
        onPressed: onPick,
        icon: const Icon(Icons.add_photo_alternate_outlined, size: 18),
        label: Text(ref.t('request.uploadPhoto')),
        style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
      );
    }

    return Row(
      children: [
        ClipRRect(
          borderRadius: K.radius(K.rSm),
          child: Image.file(photo!, width: 68, height: 68, fit: BoxFit.cover),
        ),
        const SizedBox(width: K.s12),
        Expanded(
          child: Text(
            photo!.uri.pathSegments.last,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, color: K.inkMuted),
          ),
        ),
        IconButton(
          onPressed: onClear,
          icon: const Icon(Icons.close_rounded, size: 19),
          color: K.inkMuted,
        ),
      ],
    );
  }
}
