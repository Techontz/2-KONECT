import 'api_client.dart';

/// The real D2K conversation system.
///
/// This is the same `messages` table the website and the seller console use —
/// there is no mobile-only chat. The backend decides who may read a thread, so
/// the app sends the counterpart's id and renders whatever comes back; it
/// never filters or authorises locally.
class RemoteChatSource {
  RemoteChatSource(this._api);

  final ApiClient _api;

  Future<List<ChatThread>> threads() async {
    final body = await _api.get('/shop/chat/threads');
    return [
      for (final raw in (body['threads'] as List? ?? const []))
        ChatThread.fromJson(raw as Map<String, dynamic>),
    ];
  }

  Future<List<ChatMessage>> messages(String withUserId) async {
    final body = await _api.get('/shop/chat/$withUserId');
    return [
      for (final raw in (body['messages'] as List? ?? const []))
        ChatMessage.fromJson(raw as Map<String, dynamic>),
    ];
  }

  /// Sends a message. Exactly one of [vendorId] or [userId] identifies the
  /// recipient; [productId] attaches the product the shopper was looking at,
  /// which is what gives the thread its context.
  Future<ChatMessage> send({
    required String body,
    String? vendorId,
    String? userId,
    String? productId,
  }) async {
    final response = await _api.post('/shop/chat', {
      'message': body,
      if (vendorId != null && vendorId.isNotEmpty)
        'vendor_id': int.tryParse(vendorId) ?? vendorId,
      if (userId != null && userId.isNotEmpty)
        'user_id': int.tryParse(userId) ?? userId,
      if (productId != null && productId.isNotEmpty)
        'product_id': int.tryParse(productId) ?? productId,
    });

    return ChatMessage.fromJson(response['sent'] as Map<String, dynamic>);
  }

  Future<int> unreadCount() async {
    final body = await _api.get('/shop/chat/unread');
    return (body['unread'] as num?)?.toInt() ?? 0;
  }
}

class ChatProductContext {
  const ChatProductContext({required this.id, required this.name, this.image = ''});

  final String id;
  final String name;
  final String image;

  static ChatProductContext? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    return ChatProductContext(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      image: '${json['image'] ?? ''}',
    );
  }
}

class ChatThread {
  const ChatThread({
    required this.userId,
    required this.name,
    required this.isVendor,
    required this.unread,
    this.vendorId,
    this.avatar = '',
    this.lastMessage = '',
    this.lastAt,
    this.product,
  });

  final String userId;
  final String? vendorId;
  final String name;
  final bool isVendor;
  final String avatar;
  final String lastMessage;
  final DateTime? lastAt;
  final int unread;
  final ChatProductContext? product;

  factory ChatThread.fromJson(Map<String, dynamic> json) => ChatThread(
        userId: '${json['user_id']}',
        vendorId: json['vendor_id'] == null ? null : '${json['vendor_id']}',
        name: '${json['name'] ?? ''}',
        isVendor: json['is_vendor'] == true,
        avatar: '${json['avatar'] ?? ''}',
        lastMessage: '${json['last_message'] ?? ''}',
        lastAt: DateTime.tryParse('${json['last_at']}'),
        unread: (json['unread'] as num?)?.toInt() ?? 0,
        product: ChatProductContext.fromJson(json['product'] as Map<String, dynamic>?),
      );
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.body,
    required this.mine,
    required this.read,
    this.sentAt,
    this.product,
  });

  final String id;
  final String body;

  /// Whether the signed-in account sent it — decided by the server, which
  /// knows who the viewer is.
  final bool mine;
  final bool read;
  final DateTime? sentAt;
  final ChatProductContext? product;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: '${json['id']}',
        body: '${json['body'] ?? ''}',
        mine: json['mine'] == true,
        read: json['read'] == true,
        sentAt: DateTime.tryParse('${json['sent_at']}'),
        product: ChatProductContext.fromJson(json['product'] as Map<String, dynamic>?),
      );
}
