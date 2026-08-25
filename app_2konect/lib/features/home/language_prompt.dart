import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/strings.dart';
import '../../core/theme/tokens.dart';
import '../../providers/language.dart';

/// Asked once, on the first launch, and never again.
///
/// The app already opens in the handset's own language when 2KONECT ships it,
/// so this is not "pick a language before you may continue" — it is a single
/// confirmation that the choice belongs to the customer rather than to their
/// device settings.
Future<void> maybeAskForLanguage(BuildContext context, WidgetRef ref) async {
  if (ref.read(languageProvider).chosen) return;
  if (!context.mounted) return;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    builder: (_) => const _LanguageSheet(),
  );
}

class _LanguageSheet extends ConsumerWidget {
  const _LanguageSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(languageProvider).language;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(color: K.line, borderRadius: K.radius(K.rPill)),
              ),
            ),
            const SizedBox(height: K.s20),
            Text(ref.t('language.choose'), style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: K.s4),
            Text(
              ref.t('language.subtitle'),
              style: const TextStyle(fontSize: 13, height: 1.45, color: K.inkMuted),
            ),
            const SizedBox(height: K.gutter),
            for (final language in AppLanguage.values)
              LanguageRow(
                language: language,
                selected: language == current,
                onTap: () => ref.read(languageProvider.notifier).set(language),
              ),
            const SizedBox(height: K.gutter),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  ref.read(languageProvider.notifier).confirmCurrent();
                  Navigator.of(context).pop();
                },
                child: Text(ref.t('language.continue')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One language, shown in its own script with the English name beneath.
class LanguageRow extends ConsumerWidget {
  const LanguageRow({
    super.key,
    required this.language,
    required this.selected,
    required this.onTap,
  });

  final AppLanguage language;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
              border: Border.all(color: selected ? K.brand : K.line, width: selected ? 1.5 : 1),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Text(language.flag, style: const TextStyle(fontSize: 20)),
                const SizedBox(width: K.s14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        language.label,
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: selected ? K.brand : K.ink,
                        ),
                      ),
                      Text(
                        language.english,
                        style: const TextStyle(fontSize: 11.5, color: K.inkFaint),
                      ),
                    ],
                  ),
                ),
                if (language == AppLanguage.en)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Text(
                      ref.t('language.recommended'),
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: K.inkFaint),
                    ),
                  ),
                Icon(
                  selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                  size: 19,
                  color: selected ? K.brand : K.lineStrong,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
