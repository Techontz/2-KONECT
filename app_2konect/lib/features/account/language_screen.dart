import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/strings.dart';
import '../../core/theme/tokens.dart';
import '../../providers/language.dart';
import '../home/language_prompt.dart';

/// Changing the interface language.
///
/// The change is immediate and total — every screen, every label, every empty
/// state. It is deliberately **not** a currency switch: 2KONECT prices in TZS
/// because it sells in Tanzania, and the server sends the currency with every
/// figure. Reading the interface in French does not turn shillings into euros.
///
/// Product names, descriptions and seller names are never translated either.
/// They are the seller's own words and are shown exactly as written.
class LanguageScreen extends ConsumerWidget {
  const LanguageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(languageProvider).language;

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('language.label'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
        children: [
          Text(
            ref.t('language.choose'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: K.s4),
          Text(
            ref.t('language.subtitle'),
            style: const TextStyle(fontSize: 13, height: 1.5, color: K.inkMuted),
          ),
          const SizedBox(height: K.s20),
          for (final language in AppLanguage.values)
            LanguageRow(
              language: language,
              selected: language == current,
              onTap: () => ref.read(languageProvider.notifier).set(language),
            ),
          const SizedBox(height: K.gutter),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline_rounded, size: 14, color: K.inkFaint),
              const SizedBox(width: K.s8),
              Expanded(
                child: Text(
                  // Language ≠ currency, said plainly.
                  ref.t('app.languageNotCurrency'),
                  style: const TextStyle(fontSize: 11.5, height: 1.5, color: K.inkFaint),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
