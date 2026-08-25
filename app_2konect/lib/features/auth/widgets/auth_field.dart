import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';

/// One labelled field, drawn exactly as the website draws it: a 12px
/// semibold label in muted ink above a 44px control with a `line-strong`
/// hairline that turns brand navy on focus.
class AuthField extends StatelessWidget {
  const AuthField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.obscure = false,
    this.keyboard,
    this.textInputAction = TextInputAction.next,
    this.autofill = const [],
    this.capitalisation = TextCapitalization.none,
    this.validator,
    this.onSubmitted,
    this.suffix,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final bool obscure;
  final TextInputType? keyboard;
  final TextInputAction textInputAction;
  final Iterable<String> autofill;
  final TextCapitalization capitalisation;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onSubmitted;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: K.s4, left: K.s2),
          child: Text(
            label,
            style: const TextStyle(
              fontFamily: K.fontFamily,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: K.inkMuted,
            ),
          ),
        ),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboard,
          textInputAction: textInputAction,
          autofillHints: autofill,
          textCapitalization: capitalisation,
          validator: validator,
          onFieldSubmitted: onSubmitted,
          style: const TextStyle(
            fontFamily: K.fontFamily,
            fontSize: 14.5,
            fontWeight: FontWeight.w500,
            color: K.ink,
          ),
          decoration: InputDecoration(
            hintText: hint,
            suffixIcon: suffix,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: K.s12,
              vertical: K.s12,
            ),
            enabledBorder: _border(K.lineStrong),
            border: _border(K.lineStrong),
            focusedBorder: _border(K.brand, width: 1.5),
          ),
        ),
      ],
    );
  }

  static OutlineInputBorder _border(Color colour, {double width = 1}) =>
      OutlineInputBorder(
        borderRadius: K.radius(K.rSm),
        borderSide: BorderSide(color: colour, width: width),
      );
}

/// An inline notice — a success confirmation or a refusal — in the same
/// tinted block the website uses for both.
class AuthNotice extends StatelessWidget {
  const AuthNotice({super.key, required this.message, required this.tone});

  final String message;
  final AuthNoticeTone tone;

  @override
  Widget build(BuildContext context) {
    final (ground, ink) = switch (tone) {
      AuthNoticeTone.success => (K.successSoft, K.success),
      AuthNoticeTone.danger => (K.dangerSoft, K.danger),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: K.s12, vertical: K.s10),
      decoration: BoxDecoration(
        color: ground,
        borderRadius: K.radius(K.rSm),
      ),
      child: Text(
        message,
        style: TextStyle(
          fontFamily: K.fontFamily,
          fontSize: 13,
          height: 1.45,
          fontWeight: FontWeight.w600,
          color: ink,
        ),
      ),
    );
  }
}

enum AuthNoticeTone { success, danger }
