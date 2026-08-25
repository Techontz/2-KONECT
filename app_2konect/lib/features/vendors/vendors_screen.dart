import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/tokens.dart';
import '../../providers/catalog.dart';
import '../../providers/language.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// The sellers on 2KONECT.
///
/// The checkmark next to a name is granted by an administrator; it is never
/// something a seller can award themselves.
class VendorsScreen extends ConsumerWidget {
  const VendorsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vendors = ref.watch(vendorsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('footer.ourVendors'))),
      body: vendors.when(
        loading: () => const Loading(),
        error: (error, _) =>
            ErrorState(error: error, onRetry: () => ref.invalidate(vendorsProvider)),
        data: (data) => data.isEmpty
            ? EmptyState(icon: Icons.storefront_outlined, title: ref.t('listing.noResults'))
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
                itemCount: data.length,
                separatorBuilder: (_, _) => const SizedBox(height: K.s10),
                itemBuilder: (context, index) {
                  final vendor = data[index];
                  return Panel(
                    onTap: () => context.push(
                      '/shop?vendor=${vendor.id}&title=${Uri.encodeComponent(vendor.name)}',
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: K.brand50,
                            borderRadius: K.radius(K.rSm),
                            border: K.hairline,
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: vendor.logo == null
                              ? const Icon(Icons.storefront_rounded, size: 20, color: K.brand400)
                              : ProductImage(url: vendor.logo, decodeWidth: 100),
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
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  if (vendor.isVerified) ...[
                                    const SizedBox(width: K.s6),
                                    const VerifiedBadge(),
                                  ],
                                ],
                              ),
                              const SizedBox(height: K.s2),
                              Text(
                                [
                                  ref.t('listing.productCount', {'count': vendor.productCount}),
                                  if (vendor.memberSince != null) vendor.memberSince!,
                                ].join(' · '),
                                style: const TextStyle(fontSize: 11.5, color: K.inkFaint),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded, size: 20, color: K.inkFaint),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}
