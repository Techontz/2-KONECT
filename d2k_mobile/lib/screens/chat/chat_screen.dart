import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../data/remote_chat_source.dart';
import '../../domain/models/product.dart';
import '../../widgets/app_image.dart';
import '../../widgets/async_state.dart';

/// One conversation with a seller.
///
/// The thread lives in the backend's `messages` table — the same one the
/// website and the seller console read — so a reply sent from either side lands
/// here. The server decides who may see a thread; the app just asks for it.
///
/// Messages refresh by polling, which matches how the backend is deployed
/// today. There are no sockets configured, so none are pretended.
class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.counterpartUserId,
    required this.title,
    this.vendorId,
    this.avatar = '',
    this.isVerified = false,
    this.product,
  });

  final String counterpartUserId;
  final String? vendorId;
  final String title;
  final String avatar;
  final bool isVerified;

  /// The product that started the conversation, attached to the first message.
  final Product? product;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();

  Loadable<List<ChatMessage>> _state = const Loadable.loading();
  Timer? _poll;
  bool _sending = false;

  /// Attached to the first message only — after that the thread has context.
  bool _productAttached = false;

  @override
  void initState() {
    super.initState();
    _load();
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _refresh());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _state = const Loadable.loading());
    try {
      final messages =
          await context.read<RemoteChatSource>().messages(widget.counterpartUserId);
      if (!mounted) return;
      setState(() => _state = Loadable.ready(messages));
      _jumpToEnd();
    } catch (error) {
      if (mounted) setState(() => _state = Loadable.failed(error));
    }
  }

  /// A silent poll: a transient failure must not replace a thread the user is
  /// reading with an error screen.
  Future<void> _refresh() async {
    if (!mounted || _sending) return;
    try {
      final messages =
          await context.read<RemoteChatSource>().messages(widget.counterpartUserId);
      if (!mounted) return;
      final grew = (_state.value?.length ?? 0) != messages.length;
      setState(() => _state = Loadable.ready(messages));
      if (grew) _jumpToEnd();
    } catch (_) {
      // Keep showing what we have; the next tick will try again.
    }
  }

  void _jumpToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    final chat = context.read<RemoteChatSource>();

    try {
      final sent = await chat.send(
        body: text,
        userId: widget.counterpartUserId,
        vendorId: widget.vendorId,
        productId: _productAttached ? null : widget.product?.id,
      );

      if (!mounted) return;
      _input.clear();
      _productAttached = true;
      setState(() {
        _state = Loadable.ready([...?_state.value, sent]);
        _sending = false;
      });
      _jumpToEnd();
    } catch (error) {
      if (!mounted) return;
      setState(() => _sending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;

    return Scaffold(
      backgroundColor: AppColors.scaffold,
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            ClipOval(
              child: widget.avatar.isNotEmpty
                  ? AppImage(widget.avatar, width: 34, height: 34, fit: BoxFit.cover)
                  : Container(
                      width: 34,
                      height: 34,
                      color: AppColors.brandYellow,
                      alignment: Alignment.center,
                      child: Text(
                        widget.title.isEmpty ? 'D' : widget.title[0].toUpperCase(),
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      widget.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (widget.isVerified) ...[
                    const SizedBox(width: 5),
                    const Icon(Icons.verified, size: 15, color: AppColors.primary),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          if (widget.product != null) _ProductContextBar(product: widget.product!),
          Expanded(
            child: LoadableView<List<ChatMessage>>(
              state: _state,
              onRetry: _load,
              isEmpty: (messages) => messages.isEmpty,
              empty: EmptyState(
                title: strings.noMessagesYet,
                message: strings.startConversation,
                icon: Icons.forum_outlined,
              ),
              builder: (context, messages) => ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
                itemCount: messages.length,
                itemBuilder: (context, index) => _Bubble(message: messages[index]),
              ),
            ),
          ),
          _Composer(
            controller: _input,
            sending: _sending,
            hint: strings.typeAMessage,
            onSend: _send,
          ),
        ],
      ),
    );
  }
}

class _ProductContextBar extends StatelessWidget {
  const _ProductContextBar({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: AppImage(
              product.primaryImage,
              width: 40,
              height: 40,
              backgroundColor: AppColors.tileSurface,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              product.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.meta,
            ),
          ),
        ],
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
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.76,
        ),
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: mine ? AppColors.brandBlack : AppColors.surface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(mine ? 14 : 4),
            bottomRight: Radius.circular(mine ? 4 : 14),
          ),
        ),
        child: Column(
          crossAxisAlignment:
              mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              message.body,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.4,
                color: mine ? Colors.white : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 3),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  message.sentAt == null
                      ? ''
                      : DateFormat('HH:mm').format(message.sentAt!.toLocal()),
                  style: TextStyle(
                    fontSize: 10,
                    color: mine ? Colors.white60 : AppColors.textTertiary,
                  ),
                ),
                if (mine) ...[
                  const SizedBox(width: 4),
                  Icon(
                    message.read ? Icons.done_all : Icons.done,
                    size: 12,
                    color: message.read ? AppColors.primary : Colors.white60,
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

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.hint,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool sending;
  final String hint;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        color: AppColors.surface,
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 4,
                textCapitalization: TextCapitalization.sentences,
                onSubmitted: (_) => onSend(),
                decoration: InputDecoration(
                  hintText: hint,
                  isDense: true,
                  filled: true,
                  fillColor: AppColors.tileSurface,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(22),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 42,
              width: 42,
              child: IconButton.filled(
                onPressed: sending ? null : onSend,
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.brandBlack,
                ),
                icon: sending
                    ? const SizedBox(
                        height: 15,
                        width: 15,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 18, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
