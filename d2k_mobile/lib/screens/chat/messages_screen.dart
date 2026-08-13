import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../data/remote_chat_source.dart';
import '../../state/auth_controller.dart';
import '../../widgets/app_image.dart';
import '../../widgets/async_state.dart';
import 'chat_screen.dart';

/// Every conversation this account is part of.
///
/// The backend returns only the viewer's own threads — a customer sees the
/// sellers they messaged, a seller sees their buyers. The app does no
/// filtering of its own, because a client-side filter is not a permission.
class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  Loadable<List<ChatThread>> _state = const Loadable.loading();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!context.read<AuthController>().isAuthenticated) {
      setState(() => _state = const Loadable.ready(<ChatThread>[]));
      return;
    }

    setState(() => _state = const Loadable.loading());
    try {
      final threads = await context.read<RemoteChatSource>().threads();
      if (mounted) setState(() => _state = Loadable.ready(threads));
    } catch (error) {
      if (mounted) setState(() => _state = Loadable.failed(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final signedIn = context.watch<AuthController>().isAuthenticated;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(title: Text(strings.messages)),
      body: !signedIn
          ? EmptyState(
              title: strings.signInToContinue,
              message: strings.signInToChat,
              icon: Icons.lock_outline,
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: LoadableView<List<ChatThread>>(
                state: _state,
                onRetry: _load,
                isEmpty: (threads) => threads.isEmpty,
                empty: EmptyState(
                  title: strings.noMessagesYet,
                  message: strings.startConversation,
                  icon: Icons.forum_outlined,
                ),
                builder: (context, threads) => ListView.separated(
                  itemCount: threads.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, color: AppColors.divider),
                  itemBuilder: (context, index) =>
                      _ThreadTile(thread: threads[index], onOpen: _open),
                ),
              ),
            ),
    );
  }

  Future<void> _open(ChatThread thread) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChatScreen(
          counterpartUserId: thread.userId,
          vendorId: thread.vendorId,
          title: thread.name,
          avatar: thread.avatar,
        ),
      ),
    );
    // Unread counts change while the thread is open.
    if (mounted) _load();
  }
}

class _ThreadTile extends StatelessWidget {
  const _ThreadTile({required this.thread, required this.onOpen});

  final ChatThread thread;
  final ValueChanged<ChatThread> onOpen;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: () => onOpen(thread),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.gutter, vertical: 6),
      leading: ClipOval(
        child: thread.avatar.isNotEmpty
            ? AppImage(thread.avatar, width: 44, height: 44, fit: BoxFit.cover)
            : Container(
                width: 44,
                height: 44,
                color: AppColors.brandYellow,
                alignment: Alignment.center,
                child: Text(
                  thread.name.isEmpty ? 'D' : thread.name[0].toUpperCase(),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
      ),
      title: Text(
        thread.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTypography.bodyStrong,
      ),
      subtitle: Text(
        thread.product != null
            ? '${thread.product!.name} · ${thread.lastMessage}'
            : thread.lastMessage,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTypography.metaMuted,
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            thread.lastAt == null
                ? ''
                : DateFormat('dd MMM').format(thread.lastAt!.toLocal()),
            style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
          ),
          if (thread.unread > 0) ...[
            const SizedBox(height: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: const BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
              ),
              child: Text(
                '${thread.unread}',
                style: const TextStyle(
                  fontSize: 10,
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
