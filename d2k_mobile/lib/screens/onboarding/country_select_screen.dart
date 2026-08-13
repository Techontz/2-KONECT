import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../data/promo_data.dart';
import '../../domain/models/location.dart';
import '../../state/app_controllers.dart';
import '../../widgets/states.dart';
import '../shell/app_shell.dart';
import 'location_picker_screen.dart';
import 'map_backdrop.dart';

/// Stage one of onboarding: pick the market.
///
/// Reproduces the reference flow — a map surface with a "Select your country"
/// sheet, then a landmark carousel with a country chip and a black Continue
/// button. Tanzania is pre-selected because it is the launch market.
class CountrySelectScreen extends StatefulWidget {
  const CountrySelectScreen({super.key});

  @override
  State<CountrySelectScreen> createState() => _CountrySelectScreenState();
}

class _CountrySelectScreenState extends State<CountrySelectScreen> {
  ShippingCountry _selected = PromoData.countries.first;
  bool _showCarousel = false;
  late final PageController _pageController =
      PageController(viewportFraction: 0.62);

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _choose(ShippingCountry country) {
    setState(() {
      _selected = country;
      _showCarousel = true;
    });
    final index = PromoData.countries.indexOf(country);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_pageController.hasClients) {
        _pageController.jumpToPage(index);
      }
    });
  }

  Future<void> _continue() async {
    await context.read<LocationController>().selectCountry(_selected);
    if (!mounted) return;
    // The picker returns a real coordinate; onboarding stores the area and
    // then enters the marketplace.
    await pickDeliveryArea(context);
    if (!mounted) return;
    await context.read<LocationController>().completeOnboarding();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AppShell()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      body: Stack(
        children: [
          Positioned.fill(
            child: MapBackdrop(
              labels: const [
                'Tanzania',
                'Kenya',
                'Uganda',
                'Rwanda',
                'Zambia',
                'Malawi',
                'Indian Ocean',
                'Dar es Salaam',
              ],
            ),
          ),
          if (_showCarousel)
            SafeArea(
              child: Container(
                width: double.infinity,
                color: AppColors.surface,
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text(
                  strings.selectYourCountry,
                  textAlign: TextAlign.center,
                  style: AppTypography.sectionTitle.copyWith(fontSize: 17),
                ),
              ),
            ),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 320),
            child: _showCarousel
                ? _CarouselStage(
                    key: const ValueKey('carousel'),
                    controller: _pageController,
                    selected: _selected,
                    onPageChanged: (i) =>
                        setState(() => _selected = PromoData.countries[i]),
                    onPickAnother: () => setState(() => _showCarousel = false),
                    onContinue: _continue,
                  )
                : _SheetStage(
                    key: const ValueKey('sheet'),
                    selected: _selected,
                    onSelect: _choose,
                  ),
          ),
        ],
      ),
    );
  }
}

class _SheetStage extends StatelessWidget {
  const _SheetStage({
    super.key,
    required this.selected,
    required this.onSelect,
  });

  final ShippingCountry selected;
  final ValueChanged<ShippingCountry> onSelect;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        margin: const EdgeInsets.fromLTRB(8, 0, 8, 8),
        padding: const EdgeInsets.fromLTRB(14, 18, 14, 10),
        decoration: const BoxDecoration(
          color: AppColors.scaffold,
          borderRadius: AppRadius.sheet,
          boxShadow: AppShadows.floating,
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                strings.selectYourCountry,
                style: AppTypography.sectionTitle.copyWith(fontSize: 17),
              ),
              const SizedBox(height: 16),
              Container(
                decoration: AppDecorations.flatCard,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Column(
                  children: [
                    for (var i = 0; i < PromoData.countries.length; i++)
                      _CountryRow(
                        country: PromoData.countries[i],
                        selected: PromoData.countries[i].code == selected.code,
                        showDivider: i != PromoData.countries.length - 1,
                        onTap: () => onSelect(PromoData.countries[i]),
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
}

class _CountryRow extends StatelessWidget {
  const _CountryRow({
    required this.country,
    required this.selected,
    required this.showDivider,
    required this.onTap,
  });

  final ShippingCountry country;
  final bool selected;
  final bool showDivider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        height: 58,
        decoration: showDivider
            ? const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: AppColors.divider),
                ),
              )
            : null,
        child: Row(
          children: [
            Text(country.flag, style: const TextStyle(fontSize: 24)),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                country.name,
                style: AppTypography.body.copyWith(fontSize: 15.5),
              ),
            ),
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? AppColors.primary : AppColors.textTertiary,
                  width: selected ? 6.5 : 1.5,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CarouselStage extends StatelessWidget {
  const _CarouselStage({
    super.key,
    required this.controller,
    required this.selected,
    required this.onPageChanged,
    required this.onPickAnother,
    required this.onContinue,
  });

  final PageController controller;
  final ShippingCountry selected;
  final ValueChanged<int> onPageChanged;
  final VoidCallback onPickAnother;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    return SafeArea(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          SizedBox(
            height: 230,
            child: PageView.builder(
              controller: controller,
              itemCount: PromoData.countries.length,
              onPageChanged: onPageChanged,
              itemBuilder: (context, index) {
                final country = PromoData.countries[index];
                final active = country.code == selected.code;
                return AnimatedPadding(
                  duration: const Duration(milliseconds: 240),
                  padding: EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: active ? 4 : 26,
                  ),
                  child: _CountryCard(country: country, active: active),
                );
              },
            ),
          ),
          const SizedBox(height: 22),
          InkWell(
            onTap: onPickAnother,
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                boxShadow: AppShadows.card,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(selected.flag, style: const TextStyle(fontSize: 18)),
                  const SizedBox(width: 10),
                  Text(selected.name, style: AppTypography.bodyStrong),
                  const SizedBox(width: 4),
                  const Icon(Icons.keyboard_arrow_down, size: 20),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
            child: PrimaryButton(
              label: strings.continueLabel,
              expand: true,
              onPressed: onContinue,
            ),
          ),
          const SizedBox(height: 14),
        ],
      ),
    );
  }
}

class _CountryCard extends StatelessWidget {
  const _CountryCard({required this.country, required this.active});

  final ShippingCountry country;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: active ? AppShadows.floating : AppShadows.card,
      ),
      padding: const EdgeInsets.all(6),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: country.isPrimary
                ? const [Color(0xFF1E9E4A), Color(0xFF0B7A6B)]
                : const [Color(0xFF3F63DD), Color(0xFF6E43C9)],
          ),
        ),
        alignment: Alignment.center,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(country.flag, style: const TextStyle(fontSize: 46)),
            const SizedBox(height: 12),
            Text(
              country.name,
              style: AppTypography.sectionTitle.copyWith(
                color: AppColors.textInverse,
                fontSize: 17,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              country.cities.first,
              style: AppTypography.metaMuted.copyWith(
                color: Colors.white70,
                fontSize: 12.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
