import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/account.dart';
import '../models/chat.dart';
import '../models/order.dart';
import '../models/seller.dart';
import 'core.dart';
import 'session.dart';

/// The customer's orders. Re-read whenever the session changes, so signing in
/// as somebody else can never show the previous account's history.
final ordersProvider = FutureProvider<List<Order>>((ref) async {
  ref.watch(isSignedInProvider);
  return ref.watch(commerceServiceProvider).orders();
});

final orderProvider = FutureProvider.family<Order, String>((ref, reference) async {
  return ref.watch(commerceServiceProvider).order(reference);
});

final deliveryOptionsProvider =
    FutureProvider.family<DeliveryOptions, String>((ref, reference) async {
  return ref.watch(commerceServiceProvider).deliveryOptions(reference);
});

final deliveriesProvider = FutureProvider<List<DeliveryRequest>>((ref) async {
  ref.watch(isSignedInProvider);
  return ref.watch(commerceServiceProvider).deliveries();
});

final addressesProvider = FutureProvider<List<Address>>((ref) async {
  ref.watch(isSignedInProvider);
  return ref.watch(accountServiceProvider).addresses();
});

final myRequestsProvider = FutureProvider<List<SourcingRequest>>((ref) async {
  ref.watch(isSignedInProvider);
  return ref.watch(accountServiceProvider).myRequests();
});

final myApplicationProvider = FutureProvider<VendorApplication?>((ref) async {
  ref.watch(isSignedInProvider);
  return ref.watch(accountServiceProvider).myApplication();
});

final chatThreadsProvider = FutureProvider<List<ChatThread>>((ref) async {
  ref.watch(isSignedInProvider);
  return ref.watch(accountServiceProvider).chatThreads();
});

final chatConversationProvider =
    FutureProvider.family<ChatConversation, int>((ref, userId) async {
  return ref.watch(accountServiceProvider).chatThread(userId);
});

/// The unread badge. Only meaningful for a signed-in account.
final unreadMessagesProvider = FutureProvider<int>((ref) async {
  if (!ref.watch(isSignedInProvider)) return 0;
  return ref.watch(accountServiceProvider).unreadCount();
});

/* ---------------- seller console ---------------- */

final sellerDashboardProvider = FutureProvider<SellerDashboard>((ref) async {
  ref.watch(isSignedInProvider);
  return ref.watch(sellerServiceProvider).dashboard();
});

final sellerStatusProvider = FutureProvider<SellerStatus>((ref) async {
  ref.watch(isSignedInProvider);
  return ref.watch(sellerServiceProvider).status();
});

final sellerOrdersProvider = FutureProvider<List<SellerOrderLine>>((ref) async {
  ref.watch(isSignedInProvider);
  return ref.watch(sellerServiceProvider).orders();
});
