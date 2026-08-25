import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/tokens.dart';
import '../../../models/product.dart';
import '../../../providers/language.dart';
import '../../../providers/session.dart';
import '../../../widgets/primitives.dart';

/// Who you are buying from.
///
/// The checkmark is granted by an administrator, never self-declared, and the
/// contact details are already normalised by the backend — a stored number
/// that cannot take WhatsApp arrives as null rather than as a broken link.
class SellerPanel extends ConsumerWidget {
  const SellerPanel({super.key, required this.vendor, required this.productId});

  final ProductVendor vendor;
  final int productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(isSignedInProvider);

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: K.brand50,
                  borderRadius: K.radius(K.rSm),
                  border: K.hairline,
                ),
                clipBehavior: Clip.antiAlias,
                child: vendor.logo == null
                    ? const Icon(Icons.storefront_rounded, size: 19, color: K.brand400)
                    : ProductImage(url: vendor.logo, decodeWidth: 96),
              ),
              const SizedBox(width: K.s12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            vendor.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                          ),
                        ),
                        if (vendor.isVerified) ...[
                          const SizedBox(width: K.s6),
                          const VerifiedBadge(size: 14),
                        ],
                      ],
                    ),
                    const SizedBox(height: K.s2),
                    Text(
                      [
                        if (vendor.location != null) vendor.location!,
                        if (vendor.memberSince != null)
                          vendor.memberSince!,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11.5, color: K.inkFaint),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: () => context.push('/shop?vendor=${vendor.id}'),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  minimumSize: const Size(0, 32),
                ),
                child: Text(ref.t('common.viewAll')),
              ),
            ],
          ),
          const SizedBox(height: K.s12),
          Row(
            children: [
              if (vendor.userId != null)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      if (!signedIn) {
                        context.push('/auth?redirect=${Uri.encodeComponent('/product/$productId')}');
                        return;
                      }
                      context.push(
                        '/messages/${vendor.userId}'
                        '?name=${Uri.encodeComponent(vendor.name)}'
                        '&vendor=${vendor.id}&product=$productId',
                      );
                    },
                    icon: const Icon(Icons.chat_bubble_outline_rounded, size: 16),
                    label: Text(
                      ref.t('chat.messages'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42)),
                  ),
                ),
              if (vendor.userId != null && vendor.whatsapp != null) const SizedBox(width: K.s8),
              if (vendor.whatsapp != null)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _open(vendor.whatsapp!),
                    icon: const Icon(Icons.phone_rounded, size: 16),
                    label: Text(
                      ref.t('seller.whatsapp'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42)),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  static Future<void> _open(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
