import 'dart:io';

import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import '../models/account.dart';
import '../models/chat.dart';
import '../models/json.dart';
import '../models/product.dart';

/// Wishlist, addresses, sourcing requests, seller applications and messaging.
class AccountService {
  const AccountService(this._api);

  final ApiClient _api;

  /* ---------------- wishlist ---------------- */

  Future<({List<ProductCardModel> products, List<int> ids})> wishlist() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/wishlist');
    return (
      products: asList(data['products'], ProductCardModel.fromJson),
      ids: (data['ids'] as List?)?.map(asInt).toList() ?? const <int>[],
    );
  }

  Future<void> addToWishlist(int productId) =>
      _api.post<dynamic>('/shop/wishlist', body: {'product_id': productId});

  Future<void> removeFromWishlist(int productId) =>
      _api.delete<dynamic>('/shop/wishlist/$productId');

  /// Hands the server what was saved while signed out and gets the merged
  /// list back, so a wishlist built as a guest survives signing in.
  Future<({List<ProductCardModel> products, List<int> ids})> syncWishlist(
      List<int> productIds) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/shop/wishlist/sync',
      body: {'product_ids': productIds},
    );
    return (
      products: asList(data['products'], ProductCardModel.fromJson),
      ids: (data['ids'] as List?)?.map(asInt).toList() ?? const <int>[],
    );
  }

  /* ---------------- delivery address book ---------------- */

  Future<List<Address>> addresses() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/addresses');
    return asList(data['addresses'], Address.fromJson);
  }

  Future<List<Address>> createAddress(Map<String, dynamic> input) async {
    final data = await _api.post<Map<String, dynamic>>('/shop/addresses', body: input);
    return asList(data['addresses'], Address.fromJson);
  }

  Future<List<Address>> updateAddress(int id, Map<String, dynamic> input) async {
    final data = await _api.put<Map<String, dynamic>>('/shop/addresses/$id', body: input);
    return asList(data['addresses'], Address.fromJson);
  }

  Future<List<Address>> deleteAddress(int id) async {
    final data = await _api.delete<Map<String, dynamic>>('/shop/addresses/$id');
    return asList(data['addresses'], Address.fromJson);
  }

  Future<List<Address>> setDefaultAddress(int id) async {
    final data = await _api.post<Map<String, dynamic>>('/shop/addresses/$id/default');
    return asList(data['addresses'], Address.fromJson);
  }

  /* ---------------- sourcing requests: "find this for me" ---------------- */

  /// Open to signed-out visitors on purpose — someone who cannot find what
  /// they need should not have to register before telling us what it is. Sent
  /// as multipart because a photo is usually the clearest description there is.
  Future<SourcingRequest> requestProduct({
    required String name,
    required int quantity,
    required String contactName,
    required String contactPhone,
    String? description,
    String? brand,
    String? preferredCountry,
    String? urgency,
    double? budgetMax,
    String? contactEmail,
    String? deliveryCity,
    File? image,
  }) async {
    final form = FormData.fromMap({
      'name': name,
      'quantity': quantity,
      'contact_name': contactName,
      'contact_phone': contactPhone,
      if (description != null && description.isNotEmpty) 'description': description,
      if (brand != null && brand.isNotEmpty) 'brand': brand,
      if (preferredCountry != null && preferredCountry.isNotEmpty)
        'preferred_country': preferredCountry,
      if (urgency != null && urgency.isNotEmpty) 'urgency': urgency,
      'budget_max': ?budgetMax,
      if (contactEmail != null && contactEmail.isNotEmpty) 'contact_email': contactEmail,
      if (deliveryCity != null && deliveryCity.isNotEmpty) 'delivery_city': deliveryCity,
      if (image != null)
        'image': await MultipartFile.fromFile(image.path, filename: image.uri.pathSegments.last),
    });

    final data = await _api.post<Map<String, dynamic>>('/shop/requests', body: form);
    return SourcingRequest.fromJson(asMap(data['request']));
  }

  Future<List<SourcingRequest>> myRequests() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/requests');
    return asList(data['requests'], SourcingRequest.fromJson);
  }

  Future<SourcingRequest> request(String reference) async {
    final data = await _api.get<Map<String, dynamic>>(
      '/shop/requests/${Uri.encodeComponent(reference)}',
    );
    return SourcingRequest.fromJson(asMap(data['request']));
  }

  Future<void> cancelRequest(String reference) =>
      _api.post<dynamic>('/shop/requests/${Uri.encodeComponent(reference)}/cancel');

  /* ---------------- selling on 2KONECT ---------------- */

  Future<VendorApplication> applyToSell(Map<String, dynamic> payload) async {
    final data = await _api.post<Map<String, dynamic>>('/shop/vendor-applications', body: payload);
    return VendorApplication.fromJson(asMap(data['application']));
  }

  Future<VendorApplication?> myApplication() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/vendor-applications/mine');
    return VendorApplication.maybe(data['application']);
  }

  /* ---------------- shopper ↔ seller messaging ---------------- */

  Future<List<ChatThread>> chatThreads() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/chat/threads');
    return asList(data['threads'], ChatThread.fromJson);
  }

  Future<int> unreadCount() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/chat/unread');
    return asInt(data['unread']);
  }

  Future<ChatConversation> chatThread(int userId) async {
    final data = await _api.get<Map<String, dynamic>>('/shop/chat/$userId');
    return ChatConversation.fromJson(data);
  }

  Future<ChatMessage> sendChat({
    required String message,
    int? vendorId,
    int? userId,
    int? productId,
  }) async {
    final data = await _api.post<Map<String, dynamic>>('/shop/chat', body: {
      'message': message,
      'vendor_id': ?vendorId,
      'user_id': ?userId,
      'product_id': ?productId,
    });
    return ChatMessage.fromJson(asMap(data['message']));
  }
}
