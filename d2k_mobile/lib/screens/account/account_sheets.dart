import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../data/promo_data.dart';
import '../../domain/models/currency.dart';
import '../../state/app_controllers.dart';
import '../../state/currency_controller.dart';
import '../auth/auth_screen.dart';

Widget _sheetShell({required String title, required Widget child}) {
  return SafeArea(
    top: false,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        Center(
          child: Container(
            width: 42,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.divider,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.gutter, 16, AppSpacing.gutter, 8),
          child: Text(title, style: AppTypography.sectionTitle),
        ),
        Flexible(child: child),
        const SizedBox(height: 12),
      ],
    ),
  );
}

/// Currency picker — the switch that drives every price in the app.
Future<void> showCurrencySheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    builder: (sheetContext) {
      final controller = sheetContext.read<CurrencyController>();
      final strings = sheetContext.strings;
      return _sheetShell(
        title: strings.currency,
        child: Consumer<CurrencyController>(
          builder: (context, currency, _) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final option in Currency.values)
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.gutter),
                  leading: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.tileSurface,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    alignment: Alignment.center,
                    child: Text(option.symbol,
                        style: AppTypography.sectionTitleSmall),
                  ),
                  title: Text(option.englishName,
                      style: AppTypography.bodyStrong),
                  subtitle: Text(
                    option == Currency.base
                        ? 'Base currency · ${option.code}'
                        : currency.rateSummary,
                    style: AppTypography.metaMuted,
                  ),
                  trailing: currency.selected == option
                      ? const Icon(Icons.check_circle,
                          color: AppColors.primary)
                      : const Icon(Icons.circle_outlined,
                          color: AppColors.textTertiary),
                  onTap: () {
                    controller.select(option);
                    Navigator.of(sheetContext).pop();
                  },
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    AppSpacing.gutter, 8, AppSpacing.gutter, 0),
                child: Text(
                  'Prices are held in TZS and converted at the configured '
                  'rate, so totals never drift between currencies.',
                  style: AppTypography.caption,
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

Future<void> showCountrySheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    builder: (sheetContext) {
      final controller = sheetContext.read<LocationController>();
      return _sheetShell(
        title: sheetContext.strings.selectYourCountry,
        child: Consumer<LocationController>(
          builder: (context, location, _) => ListView(
            shrinkWrap: true,
            children: [
              for (final country in PromoData.countries)
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.gutter),
                  leading:
                      Text(country.flag, style: const TextStyle(fontSize: 26)),
                  title: Text(country.name, style: AppTypography.bodyStrong),
                  subtitle: Text(
                    '${country.dialCode} · ${country.cities.length} cities',
                    style: AppTypography.metaMuted,
                  ),
                  trailing: location.country.code == country.code
                      ? const Icon(Icons.check_circle,
                          color: AppColors.primary)
                      : null,
                  onTap: () {
                    controller.selectCountry(country);
                    Navigator.of(sheetContext).pop();
                  },
                ),
            ],
          ),
        ),
      );
    },
  );
}

Future<void> showAddressSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    builder: (sheetContext) {
      final addresses = sheetContext.read<LocationController>().savedAddresses;
      return _sheetShell(
        title: sheetContext.strings.addresses,
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final address in addresses)
              ListTile(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
                leading: Icon(
                  address.label == 'Home'
                      ? Icons.home_outlined
                      : Icons.work_outline,
                  color: AppColors.textPrimary,
                ),
                title: Row(
                  children: [
                    Text(address.label, style: AppTypography.bodyStrong),
                    if (address.isDefault) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(AppRadius.xs),
                        ),
                        child: Text('Default',
                            style: AppTypography.meta
                                .copyWith(color: AppColors.primary)),
                      ),
                    ],
                  ],
                ),
                subtitle: Text(address.summary, style: AppTypography.metaMuted),
              ),
          ],
        ),
      );
    },
  );
}

Future<void> showPaymentSheet(BuildContext context) {
  const methods = [
    (Icons.smartphone, 'M-Pesa', 'Pay from your Vodacom wallet'),
    (Icons.smartphone, 'Tigo Pesa', 'Instant mobile money'),
    (Icons.smartphone, 'Airtel Money', 'Instant mobile money'),
    (Icons.credit_card, 'Card', 'Visa / Mastercard'),
    (Icons.payments_outlined, 'Cash on delivery', 'Pay the rider on arrival'),
  ];
  return showModalBottomSheet<void>(
    context: context,
    builder: (sheetContext) => _sheetShell(
      title: sheetContext.strings.paymentMethods,
      child: ListView(
        shrinkWrap: true,
        children: [
          for (final method in methods)
            ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
              leading: Icon(method.$1, color: AppColors.textPrimary),
              title: Text(method.$2, style: AppTypography.bodyStrong),
              subtitle: Text(method.$3, style: AppTypography.metaMuted),
              trailing: const Icon(Icons.chevron_right,
                  color: AppColors.textTertiary),
            ),
        ],
      ),
    ),
  );
}

Future<void> showHelpSheet(BuildContext context) {
  const topics = [
    (Icons.local_shipping_outlined, 'Track my order'),
    (Icons.assignment_return_outlined, 'Returns & refunds'),
    (Icons.chat_bubble_outline, 'Chat with D2K support'),
    (Icons.call_outlined, 'Call +255 700 000 000'),
    (Icons.privacy_tip_outlined, 'Privacy policy'),
    (Icons.gavel_outlined, 'Terms of service'),
  ];
  return showModalBottomSheet<void>(
    context: context,
    builder: (sheetContext) => _sheetShell(
      title: sheetContext.strings.help,
      child: ListView(
        shrinkWrap: true,
        children: [
          for (final topic in topics)
            ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
              leading: Icon(topic.$1, color: AppColors.textPrimary),
              title: Text(topic.$2, style: AppTypography.body),
              trailing: const Icon(Icons.chevron_right,
                  color: AppColors.textTertiary),
            ),
        ],
      ),
    ),
  );
}

/// Opens the real sign-in screen.
///
/// This used to be a bottom sheet that took a name and a phone number and
/// marked the app "logged in" locally, with no server involved. Identity now
/// comes from the backend only.
Future<void> showLoginSheet(BuildContext context) {
  return Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => const AuthScreen()),
  );
}
