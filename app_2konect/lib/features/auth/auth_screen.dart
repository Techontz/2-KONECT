import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../providers/language.dart';
import '../../providers/session.dart';
import '../../providers/wishlist.dart';
import 'widgets/auth_field.dart';
import 'widgets/auth_segmented.dart';
import 'widgets/google_button.dart';

/// Sign in, or create an account.
///
/// A mobile adaptation of the website's `AuthSheet`, which it follows closely:
/// the navy brand band with the mark, a two-cell segmented switch, the same
/// fields in the same order, the same inline notices, and "Continue with
/// Google" under an OR rule.
///
/// Two behaviours are the website's exactly, and both are easy to get wrong:
///
///  * **Signing up does not sign you in.** The website's `signUp` is
///    documented as "creates the account without signing in"; it returns to
///    the login half with "Account created. Sign in to continue." Doing
///    otherwise here would give the phone a different session model from the
///    browser for the same account.
///  * **There is no "forgot password".** The website has none, so inventing
///    one would be a button that goes nowhere.
///
/// One architecture throughout: Firebase proves identity when Google is used,
/// Laravel issues the Sanctum token, and every request from then on carries
/// it. After a successful sign-in the customer goes **back to where they were
/// going** — the checkout they were blocked from, the order they tapped —
/// rather than being dropped on the home screen.
class AuthScreen extends ConsumerStatefulWidget {
  const AuthScreen({super.key, this.redirectTo, this.startOnRegister = false});

  final String? redirectTo;
  final bool startOnRegister;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  /// One form around both halves.
  ///
  /// A `Form` *inside* the switcher carries a GlobalKey through a transition
  /// in which both halves are briefly mounted, and its state stops resolving —
  /// which is how validation silently did nothing on the sign-up half. The
  /// form stays put and only the fields inside it change.
  final _formKey = GlobalKey<FormState>();

  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  late int _mode = widget.startOnRegister ? 1 : 0;
  bool _busy = false;
  bool _obscure = true;
  String? _error;
  String? _notice;

  bool get _registering => _mode == 1;

  @override
  void dispose() {
    for (final controller in [_name, _email, _phone, _password, _confirm]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _switchTo(int mode) {
    if (mode == _mode) return;
    setState(() {
      _mode = mode;
      _error = null;
      _notice = null;
    });
  }

  /// Where to go once there is a session.
  void _done() {
    // Merge whatever was saved as a guest into the account's own list.
    ref.read(wishlistProvider.notifier).unawaitedSync();

    if (!mounted) return;
    final target = widget.redirectTo;
    if (target != null && target.isNotEmpty) {
      context.pushReplacement(target);
    } else if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });

    try {
      final session = ref.read(sessionProvider.notifier);

      if (_registering) {
        await session.createAccount(
          name: _name.text,
          email: _email.text,
          phone: _phone.text,
          password: _password.text,
          passwordConfirmation: _confirm.text,
        );

        // Hand the new account straight to the login step rather than leaving
        // the shopper looking at the form they just submitted — the website's
        // own behaviour, and the reason `createAccount` returns no session.
        if (!mounted) return;
        setState(() {
          _busy = false;
          _mode = 0;
          _notice = ref.read(tProvider)('auth.registered');
          _password.clear();
          _confirm.clear();
        });
        return;
      }

      await session.login(email: _email.text, password: _password.text);
      _done();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error.message;
      });
    } on Object {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = ref.read(tProvider)('auth.failed');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: K.surface,
      appBar: AppBar(
        backgroundColor: K.brand,
        title: Text(_registering ? ref.t('auth.signup') : ref.t('auth.login')),
      ),
      // `resizeToAvoidBottomInset` plus a scroll view is what keeps the field
      // being typed into above the keyboard on a small handset.
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(context).bottom + K.s24,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _Banner(registering: _registering),
              Padding(
                padding: const EdgeInsets.fromLTRB(K.s20, K.s20, K.s20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    AuthSegmented(
                      labels: [ref.t('auth.login'), ref.t('auth.signup')],
                      index: _mode,
                      onChanged: _switchTo,
                    ),
                    const SizedBox(height: K.s20),

                    // The two halves are one surface the reader moves through,
                    // so the form slides and fades rather than being replaced.
                    Form(
                      key: _formKey,
                      child: AnimatedSize(
                        duration: K.normal,
                        curve: K.easing,
                        alignment: Alignment.topCenter,
                        child: AnimatedSwitcher(
                          duration: K.normal,
                          switchInCurve: K.easing,
                          switchOutCurve: K.easing,
                          layoutBuilder: (current, previous) => Stack(
                            alignment: Alignment.topCenter,
                            children: [...previous, ?current],
                          ),
                          transitionBuilder: (child, animation) {
                            final incoming = child.key == ValueKey<int>(_mode);
                            final offset = Tween<Offset>(
                              begin: Offset(incoming ? 0.06 : -0.06, 0),
                              end: Offset.zero,
                            ).animate(animation);
                            return FadeTransition(
                              opacity: animation,
                              child: SlideTransition(
                                position: offset,
                                child: child,
                              ),
                            );
                          },
                          child: _registering ? _registerForm() : _loginForm(),
                        ),
                      ),
                    ),

                    if (_notice != null) ...[
                      const SizedBox(height: K.s12),
                      AuthNotice(
                        message: _notice!,
                        tone: AuthNoticeTone.success,
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: K.s12),
                      AuthNotice(message: _error!, tone: AuthNoticeTone.danger),
                    ],

                    const SizedBox(height: K.s16),
                    SizedBox(
                      height: 52,
                      child: FilledButton(
                        onPressed: _busy ? null : _submit,
                        child: _busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                _registering
                                    ? ref.t('auth.createAccountBtn')
                                    : ref.t('auth.login'),
                              ),
                      ),
                    ),

                    // Shoppers only — sellers and staff keep the password flow.
                    GoogleButton(onSignedIn: (_) => _done()),

                    const SizedBox(height: K.s16),
                    Text(
                      ref.t('auth.termsNote', {'brand': Brand.name}),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontFamily: K.fontFamily,
                        fontSize: 11,
                        height: 1.5,
                        color: K.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /* ---- the two halves ---- */

  Widget _loginForm() => Column(
    key: const ValueKey(0),
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _emailField(action: TextInputAction.next),
      const SizedBox(height: K.s12),
      _passwordField(
        label: ref.t('auth.password'),
        controller: _password,
        autofill: const [AutofillHints.password],
        action: TextInputAction.done,
        onSubmitted: (_) => _submit(),
      ),
    ],
  );

  Widget _registerForm() => Column(
    key: const ValueKey(1),
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      AuthField(
        label: ref.t('auth.name'),
        controller: _name,
        capitalisation: TextCapitalization.words,
        autofill: const [AutofillHints.name],
        validator: (value) => (value ?? '').trim().length < 2
            ? ref.read(tProvider)('common.required')
            : null,
      ),
      const SizedBox(height: K.s12),
      AuthField(
        label: ref.t('auth.phone'),
        controller: _phone,
        hint: ref.t('checkout.phonePlaceholder'),
        keyboard: TextInputType.phone,
        autofill: const [AutofillHints.telephoneNumber],
        validator: (value) => (value ?? '').trim().length < 9
            ? ref.read(tProvider)('common.required')
            : null,
      ),
      const SizedBox(height: K.s12),
      _emailField(action: TextInputAction.next),
      const SizedBox(height: K.s12),
      _passwordField(
        label: ref.t('auth.password'),
        controller: _password,
        autofill: const [AutofillHints.newPassword],
        action: TextInputAction.next,
        validator: (value) {
          final text = value ?? '';
          if (text.isEmpty) return ref.read(tProvider)('auth.errPassword');
          if (text.length < 8) {
            return ref.read(tProvider)('auth.errPasswordShort');
          }
          return null;
        },
      ),
      const SizedBox(height: K.s12),
      _passwordField(
        label: ref.t('auth.confirmPassword'),
        controller: _confirm,
        autofill: const [AutofillHints.newPassword],
        action: TextInputAction.done,
        onSubmitted: (_) => _submit(),
        validator: (value) => value != _password.text
            ? ref.read(tProvider)('app.passwordsDiffer')
            : null,
      ),
    ],
  );

  Widget _emailField({required TextInputAction action}) => AuthField(
    label: ref.t('auth.email'),
    controller: _email,
    keyboard: TextInputType.emailAddress,
    textInputAction: action,
    autofill: const [AutofillHints.email],
    validator: (value) {
      final text = (value ?? '').trim();
      if (text.isEmpty) return ref.read(tProvider)('auth.errEmail');
      if (!text.contains('@') || !text.contains('.')) {
        return ref.read(tProvider)('auth.errEmailValid');
      }
      return null;
    },
  );

  Widget _passwordField({
    required String label,
    required TextEditingController controller,
    required Iterable<String> autofill,
    required TextInputAction action,
    String? Function(String?)? validator,
    ValueChanged<String>? onSubmitted,
  }) => AuthField(
    label: label,
    controller: controller,
    obscure: _obscure,
    textInputAction: action,
    autofill: autofill,
    onSubmitted: onSubmitted,
    validator:
        validator ??
        (value) => (value ?? '').isEmpty
            ? ref.read(tProvider)('auth.errPassword')
            : null,
    suffix: IconButton(
      icon: Icon(
        _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
        size: 19,
        color: K.inkMuted,
      ),
      onPressed: () => setState(() => _obscure = !_obscure),
    ),
  );
}

/// The navy band at the top: the mark, and one line saying which half you are
/// on. The website's `brand-ground` — a near-flat navy with one cool
/// highlight, rather than a gradient wash.
class _Banner extends ConsumerWidget {
  const _Banner({required this.registering});

  final bool registering;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(K.s24, K.s24, K.s24, K.s28),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomCenter,
          colors: [K.brand, K.brandDeep],
        ),
      ),
      child: Column(
        children: [
          Image.asset(
            Brand.markWhite,
            height: 30,
            errorBuilder: (_, _, _) => const Text(
              Brand.name,
              style: TextStyle(
                fontFamily: K.fontFamily,
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: K.s10),
          AnimatedSwitcher(
            duration: K.normal,
            child: Text(
              registering
                  ? ref.t('auth.join', {'brand': Brand.name})
                  : ref.t('auth.welcomeBack'),
              key: ValueKey(registering),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: K.fontFamily,
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.white.withValues(alpha: 0.8),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
