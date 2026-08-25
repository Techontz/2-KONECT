import 'json.dart';

/// The product a conversation is about, when it started from one.
class ChatProductContext {
  const ChatProductContext({required this.id, required this.name, this.image});

  final int id;
  final String name;
  final String? image;

  factory ChatProductContext.fromJson(Map<String, dynamic> json) => ChatProductContext(
        id: asInt(json['id']),
        name: asString(json['name']),
        image: asStringOrNull(json['image']),
      );

  static ChatProductContext? maybe(Object? value) {
    final map = asMapOrNull(value);
    return map == null ? null : ChatProductContext.fromJson(map);
  }
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

  final int id;
  final String body;

  /// Written by the signed-in account, as decided by the server.
  final bool mine;
  final bool read;
  final DateTime? sentAt;
  final ChatProductContext? product;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: asInt(json['id']),
        body: asString(json['body']),
        mine: asBool(json['mine']),
        read: asBool(json['read']),
        sentAt: asDate(json['sent_at']),
        product: ChatProductContext.maybe(json['product']),
      );
}

class ChatParticipant {
  const ChatParticipant({
    required this.userId,
    required this.name,
    required this.isVendor,
    this.vendorId,
    this.avatar,
  });

  final int userId;
  final String name;
  final bool isVendor;
  final int? vendorId;
  final String? avatar;

  factory ChatParticipant.fromJson(Map<String, dynamic> json) => ChatParticipant(
        userId: asInt(json['user_id']),
        name: asString(json['name']),
        isVendor: asBool(json['is_vendor']),
        vendorId: asIntOrNull(json['vendor_id']),
        avatar: asStringOrNull(json['avatar']),
      );
}

class ChatThread {
  const ChatThread({
    required this.participant,
    required this.lastMessage,
    required this.unread,
    this.lastAt,
    this.product,
  });

  final ChatParticipant participant;
  final String lastMessage;
  final DateTime? lastAt;
  final int unread;
  final ChatProductContext? product;

  factory ChatThread.fromJson(Map<String, dynamic> json) => ChatThread(
        participant: ChatParticipant.fromJson(json),
        lastMessage: asString(json['last_message']),
        lastAt: asDate(json['last_at']),
        unread: asInt(json['unread']),
        product: ChatProductContext.maybe(json['product']),
      );
}

class ChatConversation {
  const ChatConversation({
    required this.participant,
    required this.messages,
    this.product,
  });

  final ChatParticipant participant;
  final List<ChatMessage> messages;
  final ChatProductContext? product;

  factory ChatConversation.fromJson(Map<String, dynamic> json) => ChatConversation(
        participant: ChatParticipant.fromJson(asMap(json['participant'])),
        product: ChatProductContext.maybe(json['product']),
        messages: asList(json['messages'], ChatMessage.fromJson),
      );
}
