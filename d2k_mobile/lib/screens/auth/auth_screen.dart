import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../state/auth_controller.dart';
import '../../widgets/states.dart';
import '../vendor/vendor_dashboard_screen.dart';

/// Sign in / create an account.
///
/// Reached only when an action actually needs an identity — browsing, search
/// and the cart all work signed-out. Registration is where a shopper chooses
/// between a customer account and a seller account; picking "Become a seller"
/// lands them in the vendor experience once the backend confirms the role.
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, this.startAsVendor = false});

  /// Entry from "Become a seller" pre-selects the seller path.
  final bool startAsVendor;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();

  late bool _registering = widget.startAsVendor;
  late AccountRole _role =
      widget.startAsVendor ? AccountRole.vendor : AccountRole.customer;

  final _name = TextEditingController();
  final _business = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();

  bool _busy = false;

  @override
  void dispose() {
    for (final controller in [_name, _business, _email, _phone, _password]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() => _busy = true);
    final auth = context.read<AuthController>();

    final ok = _registering
        ? await auth.register(
            name: _name.text,
            email: _email.text,
            phone: _phone.text,
            password: _password.text,
            role: _role,
            businessName: _role == AccountRole.vendor ? _business.text : null,
          )
        : await auth.login(email: _email.text, password: _password.text);

    if (!mounted) return;
    setState(() => _busy = false);

    if (!ok) return;

    // A seller lands in the seller experience; everyone else returns to
    // whatever they were doing before they were asked to sign in.
    if (auth.isVendor) {
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const VendorDashboardScreen()),
      );
    } else {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final isVendorPath = _registering && _role == AccountRole.vendor;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(
        backgroundColor: AppColors.brandYellow,
        elevation: 0,
        title: Text(
          _registering ? 'Create your account' : 'Welcome back',
          style: AppTypography.sectionTitle.copyWith(fontSize: 17),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.gutter),
          children: [
            // ---- log in / sign up switch ----
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadius.sm),
                border: Border.all(color: AppColors.divider),
              ),
              padding: const EdgeInsets.all(4),
              child: Row(
                children: [
                  _SegmentButton(
                    label: 'Log in',
                    selected: !_registering,
                    onTap: () => setState(() => _registering = false),
                  ),
                  _SegmentButton(
                    label: 'Sign up',
                    selected: _registering,
                    onTap: () => setState(() => _registering = true),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // ---- account type ----
            if (_registering) ...[
              Text('I want to', style: AppTypography.metaMuted),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _RoleCard(
                      icon: Icons.shopping_bag_outlined,
                      title: 'Shop',
                      subtitle: 'Buy from local sellers',
                      selected: _role == AccountRole.customer,
                      onTap: () => setState(() => _role = AccountRole.customer),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _RoleCard(
                      icon: Icons.storefront_outlined,
                      title: 'Sell',
                      subtitle: 'Become a seller',
                      selected: _role == AccountRole.vendor,
                      onTap: () => setState(() => _role = AccountRole.vendor),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
            ],

            Form(
              key: _formKey,
              child: Column(
                children: [
                  if (_registering) ...[
                    if (isVendorPath)
                      _Field(
                        controller: _business,
                        label: 'Business / store name',
                        validator: _required,
                      ),
                    _Field(
                      controller: _name,
                      label: 'Full name',
                      validator: _required,
                    ),
                    _Field(
                      controller: _phone,
                      label: 'Phone number',
                      keyboardType: TextInputType.phone,
                      validator: _required,
                    ),
                  ],
                  _Field(
                    controller: _email,
                    label: 'Email address',
                    keyboardType: TextInputType.emailAddress,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Enter your email address';
                      }
                      if (!value.contains('@')) return 'Enter a valid email address';
                      return null;
                    },
                  ),
                  _Field(
                    controller: _password,
                    label: 'Password',
                    obscure: true,
                    validator: (value) {
                      if (value == null || value.isEmpty) return 'Enter your password';
                      if (_registering && value.length < 8) {
                        return 'Use at least 8 characters';
                      }
                      return null;
                    },
                  ),
                ],
              ),
            ),

            if (auth.error != null) ...[
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFDECEC),
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Text(
                  auth.error!,
                  style: AppTypography.meta.copyWith(color: AppColors.flashOrange),
                ),
              ),
            ],

            const SizedBox(height: 20),
            PrimaryButton(
              expand: true,
              label: _busy
                  ? 'Please wait…'
                  : _registering
                      ? (isVendorPath ? 'Create seller account' : 'Create account')
                      : 'Log in',
              onPressed: _busy ? null : _submit,
            ),

            if (isVendorPath) ...[
              const SizedBox(height: 12),
              Text(
                'Your store is reviewed by an administrator before your products '
                'appear on the marketplace. You can start adding them right away.',
                textAlign: TextAlign.center,
                style: AppTypography.metaMuted,
              ),
            ],
          ],
        ),
      ),
    );
  }

  String? _required(String? value) =>
      (value == null || value.trim().isEmpty) ? 'This field is required' : null;
}

class _SegmentButton extends StatelessWidget {
  const _SegmentButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? AppColors.brandBlack : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadius.xs),
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.bodyStrong.copyWith(
              color: selected ? AppColors.textInverse : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySoft : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.divider,
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon,
                size: 24,
                color: selected ? AppColors.primary : AppColors.textSecondary),
            const SizedBox(height: 8),
            Text(title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.bodyStrong),
            const SizedBox(height: 2),
            Text(subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.metaMuted),
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    this.validator,
    this.keyboardType,
    this.obscure = false,
  });

  final TextEditingController controller;
  final String label;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final bool obscure;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        validator: validator,
        keyboardType: keyboardType,
        obscureText: obscure,
        style: AppTypography.body,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: AppColors.surface,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            borderSide: const BorderSide(color: AppColors.divider),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            borderSide: const BorderSide(color: AppColors.divider),
          ),
        ),
      ),
    );
  }
}
