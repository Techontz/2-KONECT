import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/account.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// The sourcing requests this customer has made, and where each stands.
///
/// A request moves through a fixed number of steps — reviewed, supplier found,
/// priced, approved — and the progress bar renders exactly the `step` and
/// `total_steps` the server reports rather than guessing from the status name.
class RequestsScreen extends ConsumerWidget {
  const RequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requests = ref.watch(myRequestsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('requests.yourRequests'))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/request'),
        backgroundColor: K.brand,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded, size: 19),
        label: Text(ref.t('nav.requestProduct')),
      ),
      body: requests.when(
        loading: () => const Loading(),
        error: (error, _) =>
            ErrorState(error: error, onRetry: () => ref.invalidate(myRequestsProvider)),
        data: (data) => data.isEmpty
            ? EmptyState(
                icon: Icons.travel_explore_rounded,
                title: ref.t('requests.empty'),
                message: ref.t('requests.emptyHint'),
                actionLabel: ref.t('nav.requestProduct'),
                onAction: () => context.push('/request'),
              )
            : RefreshIndicator(
                color: K.brand,
                onRefresh: () async => ref.refresh(myRequestsProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 90),
                  itemCount: data.length,
                  separatorBuilder: (_, _) => const SizedBox(height: K.s10),
                  itemBuilder: (context, index) => _RequestCard(request: data[index]),
                ),
              ),
      ),
    );
  }
}

class _RequestCard extends ConsumerWidget {
  const _RequestCard({required this.request});

  final SourcingRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = request.totalSteps == 0
        ? 0.0
        : (request.step / request.totalSteps).clamp(0.0, 1.0);

    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (request.image != null) ...[
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: K.radius(K.rXs),
                    border: K.hairline,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: ProductImage(url: request.image, decodeWidth: 110),
                ),
                const SizedBox(width: K.s10),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.35,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: K.s4),
                    Text(
                      '${request.reference} · ${Dates.medium(request.createdAt)}',
                      style: const TextStyle(fontSize: 11, color: K.inkFaint),
                    ),
                  ],
                ),
              ),
              Tag(
                request.statusLabel,
                tone: request.isOpen ? Tone.brand : Tone.success,
              ),
            ],
          ),

          const SizedBox(height: K.s12),
          ClipRRect(
            borderRadius: K.radius(K.rPill),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 5,
              backgroundColor: K.brand100,
              valueColor: const AlwaysStoppedAnimation(K.brand),
            ),
          ),
          const SizedBox(height: K.s6),
          Text(
            ref.t('app.stepOf', {
              'step': request.step,
              'total': request.totalSteps,
            }),
            style: const TextStyle(fontSize: 11, color: K.inkFaint),
          ),

          if (request.quote != null) ...[
            const SizedBox(height: K.s12),
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: K.successSoft,
                borderRadius: K.radius(K.rSm),
                border: Border.all(color: K.localLine),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          ref.t('app.quoted'),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: K.success,
                          ),
                        ),
                        if (request.quote!.etaMin != null)
                          Text(
                            ref.t('product.arrivesIn'),
                            style: const TextStyle(fontSize: 11, color: K.inkMuted),
                          ),
                      ],
                    ),
                  ),
                  Text(
                    Money.format(request.quote!.price, request.quote!.currency),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: K.success,
                    ),
                  ),
                ],
              ),
            ),
          ],

          if (request.note != null && request.note!.isNotEmpty) ...[
            const SizedBox(height: K.s10),
            Text(
              request.note!,
              style: const TextStyle(fontSize: 12, height: 1.5, color: K.inkMuted),
            ),
          ],

          if (request.isOpen) ...[
            const SizedBox(height: K.s8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => _cancel(context, ref),
                style: TextButton.styleFrom(foregroundColor: K.danger),
                child: Text(ref.t('common.cancel')),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _cancel(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(ref.read(tProvider)('requests.withdrawConfirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(ref.read(tProvider)('common.no')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: K.danger),
            child: Text(ref.read(tProvider)('common.yes')),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(accountServiceProvider).cancelRequest(request.reference);
      ref.invalidate(myRequestsProvider);
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }
}
