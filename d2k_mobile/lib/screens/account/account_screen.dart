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
import '../../state/auth_controller.dart';
import '../chat/messages_screen.dart';
import 'addresses_screen.dart';
import '../../widgets/states.dart';
import '../auth/auth_screen.dart';
import '../vendor/vendor_dashboard_screen.dart';
import 'account_sheets.dart';
import 'orders_screen.dart';
import 'wishlist_screen.dart';

/// Account tab — blue hero, curved white sheet, sign-in CTA, preference cards
/// (currency / language / country), account shortcuts, policies and footer.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final settings = context.watch<AppSettingsController>();
    final auth = context.watch<AuthController>();
    final currency = context.watch<CurrencyController>();
    final location = context.watch<LocationController>();
    final wishlistCount = context.watch<WishlistController>().count;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(child: _Hero(strings: strings)),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter, 6, AppSpacing.gutter, 0),
              child: Column(
                children: [
                  // The real account, straight from the backend session.
                  if (auth.user != null)
                    _ProfileCard(
                      name: auth.user!.name,
                      email: auth.user!.email,
                      phone: auth.user!.phone,
                    )
                  else
                    PrimaryButton(
                      label: strings.loginSignUp,
                      expand: true,
                      onPressed: () => showLoginSheet(context),
                    ),
                  const SizedBox(height: 18),

                  // Seller entry point. An existing seller goes straight to
                  // their console; everyone else is offered the application,
                  // which is the same backend flow the website uses.
                  Builder(builder: (context) {

                    return _MenuCard(
                      rows: [
                        _MenuRow(
                          icon: Icons.storefront_outlined,
                          label: auth.isVendor
                              ? 'Seller dashboard'
                              : 'Become a seller',
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => auth.isVendor
                                  ? const VendorDashboardScreen()
                                  : const AuthScreen(startAsVendor: true),
                            ),
                          ),
                        ),
                      ],
                    );
                  }),

                  const SizedBox(height: 14),
                  _MenuCard(
                    rows: [
                      _MenuRow(
                        icon: Icons.receipt_long_outlined,
                        label: strings.orders,
                        trailingText: 0 > 0 ? '' : null,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => const OrdersScreen()),
                        ),
                      ),
                      _MenuRow(
                        icon: Icons.favorite_border,
                        label: strings.wishlist,
                        trailingText:
                            wishlistCount > 0 ? '$wishlistCount' : null,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => const WishlistScreen()),
                        ),
                      ),
                      _MenuRow(
                        icon: Icons.location_on_outlined,
                        label: strings.addresses,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const AddressesScreen(),
                          ),
                        ),
                      ),
                      _MenuRow(
                        icon: Icons.credit_card,
                        label: strings.paymentMethods,
                        onTap: () => showPaymentSheet(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _MenuCard(
                    rows: [
                      _MenuRow(
                        icon: Icons.payments_outlined,
                        label: strings.currency,
                        trailingText:
                            '${currency.selected.code} · ${currency.selected.symbol}',
                        onTap: () => showCurrencySheet(context),
                      ),
                      _MenuRow(
                        icon: Icons.translate,
                        label: strings.languageLabel,
                        trailing: _LanguageToggle(settings: settings),
                      ),
                      _MenuRow(
                        icon: Icons.public,
                        label: strings.country,
                        trailingText:
                            '${location.country.flag}  ${location.country.name}',
                        onTap: () => showCountrySheet(context),
                      ),
                      _MenuRow(
                        icon: Icons.notifications_none,
                        label: strings.notifications,
                        trailing: Switch(
                          value: settings.notificationsEnabled,
                          activeThumbColor: AppColors.primary,
                          onChanged: settings.setNotifications,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _MenuCard(
                    rows: [
                      // Real conversations with sellers, from the backend.
                      _MenuRow(
                        icon: Icons.forum_outlined,
                        label: strings.messages,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const MessagesScreen(),
                          ),
                        ),
                      ),
                      _MenuRow(
                        icon: Icons.help_outline,
                        label: strings.help,
                        onTap: () => showHelpSheet(context),
                      ),
                      _MenuRow(
                        icon: Icons.settings_outlined,
                        label: strings.settings,
                        onTap: () => showHelpSheet(context),
                      ),
                      _MenuRow(
                        icon: Icons.description_outlined,
                        label: strings.policies,
                        onTap: () => showHelpSheet(context),
                      ),
                      if (auth.isAuthenticated)
                        _MenuRow(
                          icon: Icons.logout,
                          label: strings.logout,
                          destructive: true,
                          // Ends the server session, drops the token, and
                          // forgets the account's addresses on this device.
                          onTap: () async {
                            await context.read<AuthController>().logout();
                            if (context.mounted) {
                              context.read<LocationController>().forgetAddresses();
                            }
                          },
                        ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const _Footer(),
                  const SizedBox(height: 28),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.strings});

  final AppStrings strings;

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;

    // The blue plate is positioned; the curved sheet is the sizing child so the
    // hero grows with its copy instead of clipping it.
    return Stack(
      children: [
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: topInset + 190,
          child: const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF1447C4), Color(0xFF2E6BE6)],
              ),
            ),
          ),
        ),
        Positioned(
          top: topInset + 16,
          left: 0,
          right: 0,
          child: Center(
            child: Image.asset(
              'assets/images/d2k_logo.png',
              height: 86,
              fit: BoxFit.contain,
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.only(top: topInset + 128),
          child: Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              color: AppColors.scaffold,
              borderRadius: BorderRadius.vertical(top: Radius.circular(120)),
            ),
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.xxl, 40, AppSpacing.xxl, 8),
            child: Column(
              children: [
                Text(
                  strings.accountHeadline,
                  textAlign: TextAlign.center,
                  style: AppTypography.displayLarge.copyWith(height: 1.2),
                ),
                const SizedBox(height: 8),
                Text(
                  strings.accountSubtitle,
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(
                    fontSize: 15,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.name, required this.email, this.phone});

  final String name;
  final String email;
  final String? phone;

  @override
  Widget build(BuildContext context) {
    // Whatever the account actually has: the phone is optional on a D2K
    // account, so the email is the reliable second line.
    final secondary = (phone == null || phone!.isEmpty) ? email : phone!;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppDecorations.flatCard,
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: const BoxDecoration(
              color: AppColors.brandYellow,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              name.isEmpty ? 'D' : name.characters.first.toUpperCase(),
              style: AppTypography.sectionTitle.copyWith(fontSize: 20),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: AppTypography.sectionTitleSmall),
                const SizedBox(height: 3),
                Text(secondary, style: AppTypography.metaMuted),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.textTertiary),
        ],
      ),
    );
  }
}

class _MenuCard extends StatelessWidget {
  const _MenuCard({required this.rows});

  final List<_MenuRow> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: AppDecorations.flatCard,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            rows[i],
            if (i != rows.length - 1) const Divider(height: 1),
          ],
        ],
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    this.onTap,
    this.trailing,
    this.trailingText,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Widget? trailing;
  final String? trailingText;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.error : AppColors.textPrimary;
    final leading = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 21, color: color),
        const SizedBox(width: 14),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.body.copyWith(fontSize: 15, color: color),
          ),
        ),
      ],
    );

    // Rows that carry a wide control (the language toggle, a switch) let it
    // wrap onto its own run on a narrow handset instead of overflowing the
    // card; on a normal phone this still lays out as a single row.
    final content = trailing != null
        ? Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            runSpacing: 8,
            children: [leading, trailing!],
          )
        : Row(
            children: [
              Flexible(child: leading),
              if (trailingText != null) ...[
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    trailingText!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.right,
                    style: AppTypography.metaMuted,
                  ),
                ),
              ],
              if (onTap != null) ...[
                const SizedBox(width: 6),
                const Icon(Icons.chevron_right,
                    size: 20, color: AppColors.textTertiary),
              ],
            ],
          );

    return InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 56),
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: content,
      ),
    );
  }
}

class _LanguageToggle extends StatelessWidget {
  const _LanguageToggle({required this.settings});

  final AppSettingsController settings;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.scaffold,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final language in AppLanguage.values)
            // Each segment can give ground so the control never overflows the
            // row it is dropped into.
            Flexible(
              child: GestureDetector(
                onTap: () => settings.setLanguage(language),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    color: settings.language == language
                        ? AppColors.surface
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    boxShadow:
                        settings.language == language ? AppShadows.card : null,
                  ),
                  child: Text(
                    language.nativeName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.buttonSmall.copyWith(
                      color: settings.language == language
                          ? AppColors.textPrimary
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer();

  @override
  Widget build(BuildContext context) {
    final currency = context.watch<CurrencyController>();
    return Column(
      children: [
        // The four social glyphs that used to sit here (Facebook, email,
        // LinkedIn, Instagram) were decorative: none of them had a destination.
        // Dead controls are worse than no controls, and inventing D2K social
        // URLs would be fabricating them, so they are removed until real
        // handles exist to link to.
        const SizedBox(height: 16),
        Text(
          currency.rateSummary,
          style: AppTypography.caption,
        ),
        const SizedBox(height: 4),
        Text('Version 1.0.0 (1)', style: AppTypography.caption),
        const SizedBox(height: 4),
        Text(
          '© ${DateTime.now().year} Direct2Kariakoo. All rights reserved.',
          style: AppTypography.caption,
        ),
        const SizedBox(height: 4),
        Text(
          'Serving ${PromoData.countries.length} markets across East Africa',
          style: AppTypography.caption,
        ),
      ],
    );
  }
}

/// Small helper so other screens can present the currency picker.
Future<void> openCurrencyPicker(BuildContext context) => showCurrencySheet(context);

/// Currency options exposed to the picker.
List<Currency> get supportedCurrencies => Currency.values;
