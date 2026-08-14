import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/l10n/app_strings.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';
import '../domain/models/product.dart';
import '../domain/models/vendor.dart';
import '../screens/chat/chat_screen.dart';
import '../screens/vendor/vendor_store_screen.dart';
import '../state/auth_controller.dart';
import 'app_image.dart';
import 'toast.dart';

/// The seller block on a product page: who is selling, whether an administrator
/// verified them, and every way to reach them.
///
/// Nothing here is decorative. An action is offered only when the backend
/// supplied a usable value for it — an unreachable number is hidden and said
/// so, rather than opening a dialer with nothing in it.
class VendorPanel extends StatelessWidget {
  const VendorPanel({super.key, required this.vendor, this.product});

  final Vendor vendor;

  /// The item the shopper is looking at. It gives a new conversation its
  /// context, so the seller knows what is being asked about.
  final Product? product;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;

    return Container(
      color: AppColors.surface,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(AppSpacing.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.md),
                child: vendor.logo.isNotEmpty
                    ? AppImage(
                        vendor.logo,
                        width: 46,
                        height: 46,
                        fit: BoxFit.cover,
                        backgroundColor: AppColors.tileSurface,
                      )
                    : Container(
                        width: 46,
                        height: 46,
                        color: AppColors.brandYellow,
                        alignment: Alignment.center,
                        child: Text(
                          vendor.name.isEmpty ? 'D' : vendor.name[0].toUpperCase(),
                          style: AppTypography.sectionTitle,
                        ),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            vendor.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.bodyStrong,
                          ),
                        ),
                        // The checkmark tracks is_verified only. An approved
                        // seller is allowed to trade; that is not the same
                        // thing as being verified, and the app must never
                        // conflate them.
                        if (vendor.isVerified) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.verified,
                            size: 16,
                            color: AppColors.primary,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        strings.soldBy,
                        if (vendor.location != null) vendor.location!,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.metaMuted,
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => VendorStoreScreen(vendor: vendor),
                  ),
                ),
                child: Text(strings.visitStore),
              ),
            ],
          ),

          if (vendor.isVerified)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                children: [
                  const Icon(Icons.verified,
                      size: 14, color: AppColors.primary),
                  const SizedBox(width: 6),
                  Text(strings.verifiedSeller, style: AppTypography.metaMuted),
                ],
              ),
            ),

          const SizedBox(height: 14),
          Text(strings.contactSeller, style: AppTypography.bodyStrong),
          const SizedBox(height: 10),

          if (vendor.hasAnyContact)
            Row(
              children: [
                if (vendor.canWhatsApp)
                  _ContactButton(
                    icon: Icons.chat_bubble_outline,
                    label: strings.whatsapp,
                    color: const Color(0xFF25D366),
                    onTap: () => _openWhatsApp(context),
                  ),
                if (vendor.canCall)
                  _ContactButton(
                    icon: Icons.call_outlined,
                    label: strings.callSeller,
                    color: AppColors.primary,
                    onTap: () => _call(context),
                  ),
                if (vendor.canChat)
                  _ContactButton(
                    icon: Icons.forum_outlined,
                    label: strings.chatWithSeller,
                    color: AppColors.brandBlack,
                    onTap: () => _openChat(context),
                  ),
              ],
            )
          else
            Text(strings.phoneUnavailable, style: AppTypography.metaMuted),

          if (!vendor.canCall && !vendor.canWhatsApp && vendor.canChat)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(strings.phoneUnavailable,
                  style: AppTypography.metaMuted),
            ),
        ],
      ),
    );
  }

  Future<void> _openWhatsApp(BuildContext context) async {
    final message = product == null
        ? null
        : 'Hi ${vendor.name}, I am interested in "${product!.title}" on Direct2Kariakoo.';
    await _launch(context, vendor.whatsAppUri(message: message));
  }

  Future<void> _call(BuildContext context) => _launch(context, vendor.telUri);

  Future<void> _launch(BuildContext context, Uri uri) async {
    final strings = context.strings;
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      D2KToast.show(context, strings.phoneUnavailable, icon: Icons.error_outline);
    }
  }

  void _openChat(BuildContext context) {
    final auth = context.read<AuthController>();
    if (!auth.isAuthenticated) {
      D2KToast.show(context, context.strings.signInToChat,
          icon: Icons.lock_outline);
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatScreen(
          counterpartUserId: vendor.userId!,
          vendorId: vendor.id,
          title: vendor.name,
          avatar: vendor.logo,
          isVerified: vendor.isVerified,
          product: product,
        ),
      ),
    );
  }
}

class _ContactButton extends StatelessWidget {
  const _ContactButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.only(right: 8),
        // `OutlinedButton.icon` lays the icon and label out in an unconstrained
        // Row, so a label that cannot fit overflows its own slot instead of
        // ellipsising. Building the row explicitly lets the label flex.
        child: OutlinedButton(
          onPressed: onTap,
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
            side: BorderSide(color: color.withValues(alpha: 0.35)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 17, color: color),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: color, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
