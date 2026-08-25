import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/format.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/tokens.dart';
import '../../models/chat.dart';
import '../../providers/core.dart';
import '../../providers/language.dart';
import '../../providers/orders.dart';
import '../../widgets/primitives.dart';
import '../../widgets/states.dart';

/// One conversation with a seller.
///
/// Messages sent optimistically appear immediately and are replaced by the
/// server's own record when it answers — a chat that waits for a round trip
/// before showing what you typed feels broken, and a chat that keeps showing it
/// after a failure is a lie.
class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({
    super.key,
    required this.userId,
    this.name,
    this.vendorId,
    this.productId,
  });

  final int userId;
  final String? name;
  final int? vendorId;
  final int? productId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  bool _sending = false;

  @override
  void initState() {
    super.initState();
    // Opening a conversation from a product page pre-fills the opener, so the
    // customer does not have to explain which listing they mean.
    if (widget.productId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _seedGreeting());
    }
  }

  void _seedGreeting() {
    final conversation = ref.read(chatConversationProvider(widget.userId)).valueOrNull;
    final product = conversation?.product;
    if (product == null || !mounted || _input.text.isNotEmpty) return;
    _input.text = ref.read(tProvider)(
      'product.sellerGreeting',
      {'name': product.name, 'brand': Brand.name},
    );
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    _input.clear();

    try {
      await ref.read(accountServiceProvider).sendChat(
            message: text,
            userId: widget.userId,
            vendorId: widget.vendorId,
            productId: widget.productId,
          );
      ref.invalidate(chatConversationProvider(widget.userId));
      ref.invalidate(chatThreadsProvider);
      ref.invalidate(unreadMessagesProvider);
    } on ApiException catch (error) {
      if (!mounted) return;
      // Put the text back so nothing is lost.
      _input.text = text;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final conversation = ref.watch(chatConversationProvider(widget.userId));

    return Scaffold(
      appBar: AppBar(
        title: Text(
          conversation.valueOrNull?.participant.name ?? widget.name ?? ref.t('chat.title'),
        ),
      ),
      body: Column(
        children: [
          if (conversation.valueOrNull?.product != null)
            _ProductContext(product: conversation.value!.product!),
          Expanded(
            child: conversation.when(
              loading: () => const Loading(),
              error: (error, _) => ErrorState(
                error: error,
                onRetry: () => ref.invalidate(chatConversationProvider(widget.userId)),
              ),
              data: (data) => data.messages.isEmpty
                  ? EmptyState(
                      icon: Icons.chat_bubble_outline_rounded,
                      title: ref.t('chat.empty'),
                      message: ref.t('chat.emptyHint'),
                    )
                  : ListView.builder(
                      controller: _scroll,
                      reverse: true,
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                      itemCount: data.messages.length,
                      itemBuilder: (context, index) {
                        // Reversed: the newest message sits at the bottom and
                        // the list opens there without a scroll jump.
                        final message = data.messages[data.messages.length - 1 - index];
                        return _Bubble(message: message);
                      },
                    ),
            ),
          ),
          _Composer(
            controller: _input,
            sending: _sending,
            onSend: _send,
          ),
        ],
      ),
    );
  }
}

class _ProductContext extends ConsumerWidget {
  const _ProductContext({required this.product});

  final ChatProductContext product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return InkWell(
      onTap: () => context.push('/product/${product.id}'),
      child: Container(
        color: K.surface,
        padding: const EdgeInsets.fromLTRB(14, 9, 14, 9),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: K.radius(K.rXs),
                border: K.hairline,
              ),
              clipBehavior: Clip.antiAlias,
              child: ProductImage(
                url: product.image,
                padding: const EdgeInsets.all(3),
                decodeWidth: 80,
              ),
            ),
            const SizedBox(width: K.s10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    ref.t('chat.about'),
                    style: const TextStyle(fontSize: 10, color: K.inkFaint),
                  ),
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 18, color: K.inkFaint),
          ],
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final mine = message.mine;

    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.76),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.fromLTRB(12, 9, 12, 7),
        decoration: BoxDecoration(
          color: mine ? K.brand : K.surface,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(K.rMd),
            topRight: Radius.circular(K.rMd),
            bottomLeft: Radius.circular(mine ? K.rMd : K.rXs),
            bottomRight: Radius.circular(mine ? K.rXs : K.rMd),
          ),
          border: mine ? null : K.hairline,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message.body,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.45,
                color: mine ? Colors.white : K.ink,
              ),
            ),
            const SizedBox(height: K.s4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  Dates.timeOnly(message.sentAt),
                  style: TextStyle(
                    fontSize: 9.5,
                    color: mine ? K.brand300 : K.inkFaint,
                  ),
                ),
                if (mine) ...[
                  const SizedBox(width: K.s4),
                  Icon(
                    message.read ? Icons.done_all_rounded : Icons.done_rounded,
                    size: 12,
                    color: K.brand300,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Composer extends ConsumerWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: const BoxDecoration(
        color: K.surface,
        border: Border(top: BorderSide(color: K.line)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 9, 8, 9),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: 1,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    hintText: ref.t('chat.placeholder'),
                    fillColor: K.surfaceAlt,
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  ),
                ),
              ),
              const SizedBox(width: K.s6),
              IconButton.filled(
                onPressed: sending ? null : onSend,
                style: IconButton.styleFrom(
                  backgroundColor: K.brand,
                  minimumSize: const Size(44, 44),
                ),
                icon: sending
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.send_rounded, size: 18, color: Colors.white),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
