import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/brand.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/seller.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// The seller's own standing, on two levels.
///
/// The backend keeps them genuinely separate and so does this screen:
///
///   * **Level 1 — may this seller publish?** An administrator approves the
///     store, and until they do nothing goes live.
///   * **Level 2 — does this seller carry the checkmark?** A further review
///     against a document checklist, which is what makes the badge on a
///     listing mean something.
///
/// Neither is anything the app can grant. Applying for verification is the one
/// action available here; the decision is made in the admin panel.
class SellerStatusScreen extends ConsumerWidget {
  const SellerStatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(sellerStatusProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('seller.storeProfile'))),
      body: status.when(
        loading: () => const Loading(),
        error: (error, _) {
          final failure = error is ApiException ? error : ApiException.from(error);
          if (failure.isForbidden) {
            return EmptyState(
              icon: Icons.storefront_outlined,
              title: ref.t('seller.profileNotSetUp'),
              message: ref.t('seller.profileNotSetUpHint'),
            );
          }
          return ErrorState(
            error: error,
            onRetry: () => ref.invalidate(sellerStatusProvider),
          );
        },
        data: (data) => RefreshIndicator(
          color: K.brand,
          onRefresh: () async => ref.refresh(sellerStatusProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
            children: [
              _StoreCard(store: data.store, verified: data.verification.isVerified),
              const SizedBox(height: K.s12),
              _StandingCard(standing: data.standing),
              const SizedBox(height: K.s12),
              _VerificationCard(verification: data.verification),
              const SizedBox(height: K.s14),
              Text(
                ref.t('seller.checkedBy', {'brand': Brand.name}),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11, height: 1.5, color: K.inkFaint),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StoreCard extends StatelessWidget {
  const _StoreCard({required this.store, required this.verified});

  final SellerStore store;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: K.brand50,
                  borderRadius: K.radius(K.rSm),
                  border: K.hairline,
                ),
                clipBehavior: Clip.antiAlias,
                child: store.logo == null
                    ? const Icon(Icons.storefront_rounded, size: 21, color: K.brand400)
                    : ProductImage(url: store.logo, decodeWidth: 110),
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
                            store.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                          ),
                        ),
                        if (verified) ...[
                          const SizedBox(width: K.s6),
                          const VerifiedBadge(size: 15),
                        ],
                      ],
                    ),
                    if (store.address != null)
                      Text(
                        store.address!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11.5, color: K.inkFaint),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (store.phone != null || store.email != null) ...[
            const Divider(height: 20),
            if (store.phone != null) _Row(icon: Icons.phone_rounded, value: store.phone!),
            if (store.email != null) _Row(icon: Icons.mail_outline_rounded, value: store.email!),
            if (store.memberSince != null)
              _Row(icon: Icons.event_rounded, value: store.memberSince!),
          ],
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 7),
        child: Row(
          children: [
            Icon(icon, size: 14, color: K.inkMuted),
            const SizedBox(width: K.s8),
            Expanded(
              child: Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12.5, color: K.inkSoft),
              ),
            ),
          ],
        ),
      );
}

/// Level 1 — may this seller publish at all?
class _StandingCard extends ConsumerWidget {
  const _StandingCard({required this.standing});

  final SellerStanding standing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final (title, hint, tone) = switch (standing.status) {
      'approved' => (
          ref.t('seller.statusApproved'),
          ref.t('seller.statusApprovedHint'),
          Tone.success,
        ),
      'rejected' => (ref.t('seller.statusRejected'), '', Tone.danger),
      'suspended' => (ref.t('seller.statusSuspended'), '', Tone.danger),
      _ => (
          ref.t('seller.statusPending'),
          ref.t('seller.statusPendingHint'),
          Tone.warn,
        ),
    };

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title, style: Theme.of(context).textTheme.titleMedium),
              ),
              Tag(
                standing.canPublish
                    ? ref.t('seller.approvedToSell')
                    : ref.t('seller.submitted'),
                tone: tone,
              ),
            ],
          ),
          if (hint.isNotEmpty || standing.note != null) ...[
            const SizedBox(height: K.s6),
            Text(
              standing.note ?? hint,
              style: const TextStyle(fontSize: 12.5, height: 1.5, color: K.inkMuted),
            ),
          ],
        ],
      ),
    );
  }
}

/// Level 2 — the checkmark, and what it takes to earn it.
class _VerificationCard extends ConsumerWidget {
  const _VerificationCard({required this.verification});

  final SellerVerification verification;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  ref.t('seller.verified'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (verification.isVerified)
                Tag(ref.t('seller.verified'), tone: Tone.success, icon: Icons.verified_rounded)
              else if (verification.status == 'pending')
                Tag(ref.t('seller.verifyPending'), tone: Tone.warn)
              else if (verification.status == 'rejected')
                Tag(ref.t('seller.verifyRejected'), tone: Tone.danger),
            ],
          ),
          const SizedBox(height: K.s6),
          Text(
            verification.note ?? ref.t('seller.verifyIntro'),
            style: const TextStyle(fontSize: 12.5, height: 1.5, color: K.inkMuted),
          ),

          if (verification.requirements.isNotEmpty) ...[
            const SizedBox(height: K.s14),
            for (final requirement in verification.requirements)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      requirement.submitted
                          ? Icons.check_circle_rounded
                          : Icons.radio_button_unchecked_rounded,
                      size: 16,
                      color: requirement.submitted ? K.success : K.lineStrong,
                    ),
                    const SizedBox(width: K.s10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  requirement.name,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              const SizedBox(width: K.s6),
                              Tag(
                                requirement.required
                                    ? ref.t('seller.required')
                                    : ref.t('seller.optional'),
                              ),
                            ],
                          ),
                          if (requirement.description != null)
                            Text(
                              requirement.description!,
                              style: const TextStyle(
                                fontSize: 11.5,
                                height: 1.45,
                                color: K.inkMuted,
                              ),
                            ),
                          if (requirement.note != null)
                            Text(
                              requirement.note!,
                              style: const TextStyle(
                                fontSize: 11.5,
                                height: 1.45,
                                fontWeight: FontWeight.w600,
                                color: K.warn,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],

          if (verification.canApply) ...[
            const SizedBox(height: K.s6),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => _apply(context, ref),
                child: Text(ref.t('seller.submitApplication')),
              ),
            ),
            const SizedBox(height: K.s8),
            Text(
              // Documents are uploaded in the web console, where a file picker
              // and a preview make the review worth a person's time.
              ref.t('app.documentsOnWeb'),
              style: const TextStyle(fontSize: 11, height: 1.45, color: K.inkFaint),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _apply(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(sellerServiceProvider).applyForVerification();
      ref.invalidate(sellerStatusProvider);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(ref.read(tProvider)('seller.verifyPending'))),
      );
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }
}
