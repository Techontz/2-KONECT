import '../core/network/api_client.dart';
import '../models/json.dart';
import '../models/product.dart';
import '../models/seller.dart';

/// The seller console.
///
/// Every endpoint scopes itself to the caller's own vendor on the server, so
/// one seller can never reach another's data. A 403 here means the account has
/// no store — an ordinary shopper — rather than a broken session.
class SellerService {
  const SellerService(this._api);

  final ApiClient _api;

  Future<SellerDashboard> dashboard() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/vendor/dashboard');
    return SellerDashboard.fromJson(data);
  }

  Future<List<ProductCardModel>> products() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/vendor/products');
    return asList(data['products'], ProductCardModel.fromJson);
  }

  Future<List<SellerOrderLine>> orders() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/vendor/orders');
    return asList(data['orders'], SellerOrderLine.fromJson);
  }

  Future<void> updateOrderStatus(int orderId, String status) =>
      _api.post<dynamic>('/shop/vendor/orders/$orderId/status', body: {'status': status});

  Future<SellerStatus> status() async {
    final data = await _api.get<Map<String, dynamic>>('/shop/seller/status');
    return SellerStatus.fromJson(data);
  }

  Future<void> updateStore(Map<String, dynamic> payload) =>
      _api.post<dynamic>('/shop/seller/store', body: payload);

  Future<void> applyForVerification() => _api.post<dynamic>('/shop/seller/verification');
}
