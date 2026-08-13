import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../state/app_controllers.dart';
import '../../widgets/states.dart';
import 'country_select_screen.dart';

/// First run: choose the interface language.
///
/// Kiswahili is preselected and marked as recommended — D2K's shoppers are in
/// Tanzania. The choice persists, so this appears once.
class LanguageSelectScreen extends StatefulWidget {
  const LanguageSelectScreen({super.key});

  @override
  State<LanguageSelectScreen> createState() => _LanguageSelectScreenState();
}

class _LanguageSelectScreenState extends State<LanguageSelectScreen> {
  AppLanguage _selected = AppLanguage.swahili;

  @override
  void initState() {
    super.initState();
    _selected = context.read<AppSettingsController>().language;
  }

  Future<void> _continue() async {
    await context.read<AppSettingsController>().setLanguage(_selected);
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const CountrySelectScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Read through a scope built from the pending choice so the screen
    // previews the language before it is committed.
    final strings = AppStrings(_selected);

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 36),
              RichText(
                text: const TextSpan(
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                  children: [
                    TextSpan(text: 'direct'),
                    TextSpan(
                      text: '2kariakoo',
                      style: TextStyle(color: AppColors.brandYellowDeep),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              Text(strings.languageLabel, style: AppTypography.sectionTitle),
              const SizedBox(height: 4),
              Text(
                'Chagua lugha · Choose your language',
                style: AppTypography.metaMuted,
              ),
              const SizedBox(height: 20),
              Expanded(
                child: ListView.separated(
                  itemCount: AppLanguage.values.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final language = AppLanguage.values[index];
                    final selected = language == _selected;
                    return _LanguageTile(
                      language: language,
                      selected: selected,
                      recommended: language == AppLanguage.swahili,
                      onTap: () => setState(() => _selected = language),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              PrimaryButton(
                label: strings.continueLabel,
                expand: true,
                height: 52,
                onPressed: _continue,
              ),
              const SizedBox(height: 18),
            ],
          ),
        ),
      ),
    );
  }
}

class _LanguageTile extends StatelessWidget {
  const _LanguageTile({
    required this.language,
    required this.selected,
    required this.recommended,
    required this.onTap,
  });

  final AppLanguage language;
  final bool selected;
  final bool recommended;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        decoration: BoxDecoration(
          color: selected ? AppColors.primarySoft : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: selected ? AppColors.primary : AppColors.divider,
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(language.nativeName, style: AppTypography.bodyStrong),
                      if (recommended) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.brandYellow,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'Inapendekezwa',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.brandBlack,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(language.englishName, style: AppTypography.metaMuted),
                ],
              ),
            ),
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected ? AppColors.primary : AppColors.textTertiary,
              size: 22,
            ),
          ],
        ),
      ),
    );
  }
}
