import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/account.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../providers/session.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// Applying to sell on 2KONECT.
///
/// Open to signed-out visitors, exactly as the website is — somebody who wants
/// to sell should be able to say so before they have an account. Approval is a
/// human decision made in the admin panel; nothing here grants a store, and
/// the screen says so plainly rather than implying instant access.
class SellerApplyScreen extends ConsumerStatefulWidget {
  const SellerApplyScreen({super.key});

  @override
  ConsumerState<SellerApplyScreen> createState() => _SellerApplyScreenState();
}

class _SellerApplyScreenState extends ConsumerState<SellerApplyScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _business = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _region = TextEditingController();
  final _city = TextEditingController();
  final _category = TextEditingController();
  final _products = TextEditingController();
  final _website = TextEditingController();
  final _idNumber = TextEditingController();

  String _businessType = 'individual';
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(currentUserProvider);
    if (user != null) {
      _fullName.text = user.name;
      _email.text = user.email;
      if (user.phone != null) _phone.text = user.phone!;
    }
  }

  @override
  void dispose() {
    for (final controller in [
      _fullName,
      _business,
      _phone,
      _email,
      _region,
      _city,
      _category,
      _products,
      _website,
      _idNumber,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final application = await ref.read(accountServiceProvider).applyToSell({
        'full_name': _fullName.text.trim(),
        'business_name': _business.text.trim(),
        'phone': _phone.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        if (_region.text.trim().isNotEmpty) 'region': _region.text.trim(),
        if (_city.text.trim().isNotEmpty) 'city': _city.text.trim(),
        'business_type': _businessType,
        if (_category.text.trim().isNotEmpty) 'category': _category.text.trim(),
        if (_products.text.trim().isNotEmpty) 'products': _products.text.trim(),
        if (_website.text.trim().isNotEmpty) 'website': _website.text.trim(),
        if (_idNumber.text.trim().isNotEmpty) 'id_number': _idNumber.text.trim(),
      });

      ref.invalidate(myApplicationProvider);
      if (!mounted) return;

      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(ref.read(tProvider)('sell.receivedTitle')),
          content: Text(
            ref.read(tProvider)(
              'sell.receivedBody',
              {'name': application.businessName},
            ),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: Text(ref.read(tProvider)('sell.backToShop')),
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
        _error = ref.read(tProvider)('sell.applyFailed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final existing = ref.watch(myApplicationProvider);

    // Already a seller: send them to the console rather than asking again.
    if (user?.sellerApproved == true) {
      return Scaffold(
        appBar: AppBar(title: Text(ref.t('sell.title', {'brand': Brand.name}))),
        body: EmptyState(
          icon: Icons.storefront_rounded,
          title: ref.t('sell.alreadySell'),
          message: ref.t('sell.alreadySellNote'),
          actionLabel: ref.t('sell.openSellerConsole'),
          onAction: () => context.pushReplacement('/seller'),
        ),
      );
    }

    final pending = existing.valueOrNull;
    if (pending != null && pending.isPending) {
      return Scaffold(
        appBar: AppBar(title: Text(ref.t('sell.title', {'brand': Brand.name}))),
        body: _Pending(application: pending),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('sell.title', {'brand': Brand.name}))),
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
                  Text(
                    ref.t('sell.heroTitle', {'brand': Brand.name}),
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: K.s6),
                  Text(
                    ref.t('sell.heroBody', {'country': Brand.country}),
                    style: const TextStyle(fontSize: 12.5, height: 1.55, color: K.brand300),
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
                    ref.t('sell.howItWorks'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: K.s12),
                  for (final step in const [
                    ('sell.step1', 'sell.step1Note'),
                    ('sell.step2', 'sell.step2Note'),
                    ('sell.step3', 'sell.step3Note'),
                    ('sell.step4', 'sell.step4Note'),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.check_circle_outline_rounded,
                              size: 16, color: K.brand),
                          const SizedBox(width: K.s10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  ref.t(step.$1),
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                Text(
                                  ref.t(step.$2),
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    height: 1.45,
                                    color: K.inkMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
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
                    ref.t('sell.applyToSell'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: K.s12),
                  _field(_fullName, ref.t('sell.yourName'), capitalise: true),
                  _field(_business, ref.t('sell.businessName')),
                  _field(_phone, ref.t('sell.phone'), keyboard: TextInputType.phone),
                  _field(
                    _email,
                    ref.t('sell.email'),
                    required: false,
                    keyboard: TextInputType.emailAddress,
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: _businessType,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: ref.t('sell.businessType')),
                    items: [
                      for (final type in const [
                        ('individual', 'sell.typeIndividual'),
                        ('registered', 'sell.typeRegistered'),
                        ('company', 'sell.typeCompany'),
                        ('importer', 'sell.typeImporter'),
                      ])
                        DropdownMenuItem(
                          value: type.$1,
                          child: Text(ref.t(type.$2), style: const TextStyle(fontSize: 13)),
                        ),
                    ],
                    onChanged: (value) =>
                        setState(() => _businessType = value ?? 'individual'),
                  ),
                  const SizedBox(height: K.s12),
                  _field(_region, ref.t('sell.region'), required: false),
                  _field(_city, ref.t('sell.cityArea'), required: false),
                  _field(_category, ref.t('sell.mainCategory'), required: false),
                  _field(
                    _products,
                    ref.t('sell.whatSell'),
                    required: false,
                    lines: 3,
                    hint: ref.t('sell.whatSellPlaceholder'),
                  ),
                  _field(_website, ref.t('sell.websiteOptional'), required: false),
                  _field(
                    _idNumber,
                    ref.t('sell.idOptional'),
                    required: false,
                    hint: ref.t('sell.idPlaceholder'),
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
                  : Text(ref.t('sell.submitApplication')),
            ),
            const SizedBox(height: K.s10),
            Text(
              ref.t('sell.nothingLive'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, height: 1.5, color: K.inkFaint),
            ),
          ],
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
    String? hint,
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
          labelText: label,
          hintText: hint,
          alignLabelWithHint: lines > 1,
        ),
        validator: required
            ? (value) => (value ?? '').trim().length < 2
                ? ref.read(tProvider)('common.required')
                : null
            : null,
      ),
    );
  }
}

class _Pending extends ConsumerWidget {
  const _Pending({required this.application});

  final VendorApplication application;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Panel(
          color: K.warnSoft,
          border: Border.all(color: K.warn.withValues(alpha: 0.3)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.hourglass_top_rounded, size: 19, color: K.warn),
              const SizedBox(width: K.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ref.t('seller.statusPending'),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: K.warn,
                      ),
                    ),
                    const SizedBox(height: K.s4),
                    Text(
                      application.note ?? ref.t('seller.statusPendingHint'),
                      style: const TextStyle(fontSize: 12.5, height: 1.5, color: K.inkSoft),
                    ),
                    const SizedBox(height: K.s8),
                    Tag(application.reference, tone: Tone.warn),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: K.s12),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(application.businessName,
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: K.s4),
              Text(
                application.statusLabel,
                style: const TextStyle(fontSize: 12.5, color: K.inkMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
