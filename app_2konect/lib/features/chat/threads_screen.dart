import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/theme/tokens.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// Conversations with sellers.
///
/// Scoped to the caller on the server, so a thread can only ever be one this
/// account is part of.
class ThreadsScreen extends ConsumerWidget {
  const ThreadsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final threads = ref.watch(chatThreadsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('chat.inbox'))),
      body: threads.when(
        loading: () => const Loading(),
        error: (error, _) =>
            ErrorState(error: error, onRetry: () => ref.invalidate(chatThreadsProvider)),
        data: (data) => data.isEmpty
            ? EmptyState(
                icon: Icons.chat_bubble_outline_rounded,
                title: ref.t('chat.inboxEmpty'),
                message: ref.t('chat.buyerEmptyHint'),
                actionLabel: ref.t('cart.browseProducts'),
                onAction: () => context.go('/shop'),
              )
            : RefreshIndicator(
                color: K.brand,
                onRefresh: () async {
                  ref.invalidate(unreadMessagesProvider);
                  ref.invalidate(chatThreadsProvider);
                  await ref.read(chatThreadsProvider.future);
                },
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  itemCount: data.length,
                  separatorBuilder: (_, _) => const Padding(
                    padding: EdgeInsets.only(left: 74),
                    child: Divider(height: 1),
                  ),
                  itemBuilder: (context, index) {
                    final thread = data[index];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      leading: Container(
                        width: 46,
                        height: 46,
                        decoration: const BoxDecoration(
                          color: K.brand50,
                          shape: BoxShape.circle,
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: thread.participant.avatar == null
                            ? Center(
                                child: Text(
                                  thread.participant.name.isEmpty
                                      ? '?'
                                      : thread.participant.name[0].toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: K.brand,
                                  ),
                                ),
                              )
                            : ProductImage(
                                url: thread.participant.avatar,
                                fit: BoxFit.cover,
                                decodeWidth: 100,
                              ),
                      ),
                      title: Row(
                        children: [
                          Flexible(
                            child: Text(
                              thread.participant.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                            ),
                          ),
                          if (thread.participant.isVendor) ...[
                            const SizedBox(width: K.s6),
                            const Icon(Icons.storefront_rounded, size: 12, color: K.brand400),
                          ],
                        ],
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox(height: K.s2),
                          Text(
                            thread.lastMessage,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 12.5,
                              color: thread.unread > 0 ? K.ink : K.inkMuted,
                              fontWeight:
                                  thread.unread > 0 ? FontWeight.w600 : FontWeight.w400,
                            ),
                          ),
                          if (thread.product != null) ...[
                            const SizedBox(height: K.s4),
                            Tag(thread.product!.name, tone: Tone.neutral),
                          ],
                        ],
                      ),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            Dates.short(thread.lastAt),
                            style: const TextStyle(fontSize: 10.5, color: K.inkFaint),
                          ),
                          const SizedBox(height: K.s6),
                          if (thread.unread > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                              constraints: const BoxConstraints(minWidth: 18),
                              decoration: BoxDecoration(
                                color: K.brand,
                                borderRadius: K.radius(K.rPill),
                              ),
                              child: Text(
                                thread.unread > 99 ? '99+' : '${thread.unread}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                        ],
                      ),
                      onTap: () => context.push(
                        '/messages/${thread.participant.userId}'
                        '?name=${Uri.encodeComponent(thread.participant.name)}'
                        '${thread.participant.vendorId == null ? '' : '&vendor=${thread.participant.vendorId}'}',
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
