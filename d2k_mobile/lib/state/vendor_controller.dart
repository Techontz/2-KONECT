import 'package:flutter/foundation.dart';

import '../data/api_client.dart';

/// Seller-side state for the mobile vendor experience.
///
/// Every figure and every action here comes from the same
/// `/api/shop/vendor/*` endpoints the website's seller console uses — the
/// business rules live in the backend, not duplicated in the app.
class VendorController extends ChangeNotifier {
  VendorController(this._api);

  final ApiClient _api;

  bool _loading = false;
  String? _error;
  VendorSummary? _summary;
  List<VendorOrderLine> _orders = const [];

  bool get loading => _loading;
  String? get error => _error;
  VendorSummary? get summary => _summary;
  List<VendorOrderLine> get orders => _orders;

  Future<void> loadDashboard() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final body = await _api.get('/shop/vendor/dashboard');
      _summary = VendorSummary.fromJson(body);
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'We could not reach the server.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> loadOrders({String? status}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final body = await _api.get('/shop/vendor/orders', query: {
        if (status != null && status.isNotEmpty) 'status': status,
        'per_page': 40,
      });

      _orders = [
        for (final line in (body['orders'] as List? ?? const []))
          VendorOrderLine.fromJson(line as Map<String, dynamic>),
      ];
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'We could not reach the server.';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Move an order line on. Cancelling returns the units to stock — the
  /// backend does that inside a transaction, so the app just re-reads.
  Future<bool> setOrderStatus(int orderId, String status) async {
    try {
      await _api.post('/shop/vendor/orders/$orderId/status', {'status': status});
      await loadOrders();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    }
  }
}

@immutable
class VendorSummary {
  const VendorSummary({
    required this.name,
    required this.isApproved,
    required this.products,
    required this.inStock,
    required this.outOfStock,
    required this.lowStock,
    required this.orders,
    required this.ordersPending,
    required this.unitsSold,
    required this.earnings,
    required this.paidOut,
    required this.salesTrend,
    required this.topProducts,
  });

  final String name;
  final bool isApproved;
  final int products;
  final int inStock;
  final int outOfStock;
  final int lowStock;
  final int orders;
  final int ordersPending;
  final int unitsSold;
  final double earnings;
  final double paidOut;
  final List<double> salesTrend;
  final List<VendorTopProduct> topProducts;

  factory VendorSummary.fromJson(Map<String, dynamic> json) {
    final vendor = (json['vendor'] as Map?) ?? const {};
    final stats = (json['stats'] as Map?) ?? const {};

    int intOf(Object? v) => (v as num?)?.toInt() ?? 0;
    double dblOf(Object? v) => (v as num?)?.toDouble() ?? 0;

    return VendorSummary(
      name: '${vendor['name'] ?? 'Your store'}',
      isApproved: vendor['is_approved'] == true || vendor['is_approved'] == 1,
      products: intOf(stats['products']),
      inStock: intOf(stats['in_stock']),
      outOfStock: intOf(stats['out_of_stock']),
      lowStock: intOf(stats['low_stock']),
      orders: intOf(stats['orders']),
      ordersPending: intOf(stats['orders_pending']),
      unitsSold: intOf(stats['units_sold']),
      earnings: dblOf(stats['earnings']),
      paidOut: dblOf(stats['paid_out']),
      salesTrend: [
        for (final point in (json['sales_trend'] as List? ?? const []))
          dblOf((point as Map)['total']),
      ],
      topProducts: [
        for (final item in (json['top_products'] as List? ?? const []))
          VendorTopProduct(
            name: '${(item as Map)['name']}',
            units: intOf(item['units']),
            revenue: dblOf(item['revenue']),
          ),
      ],
    );
  }
}

@immutable
class VendorTopProduct {
  const VendorTopProduct({
    required this.name,
    required this.units,
    required this.revenue,
  });

  final String name;
  final int units;
  final double revenue;
}

@immutable
class VendorOrderLine {
  const VendorOrderLine({
    required this.id,
    required this.reference,
    required this.status,
    required this.quantity,
    required this.total,
    required this.customerName,
    this.customerPhone,
    this.address,
    this.productName,
    this.productImage,
  });

  final int id;
  final String reference;
  final String status;
  final int quantity;
  final double total;
  final String customerName;
  final String? customerPhone;
  final String? address;
  final String? productName;
  final String? productImage;

  bool get isOpen => status != 'completed' && status != 'cancelled';

  /// The next stage this line can move to, or null when it is closed.
  String? get nextStatus => switch (status) {
        'pending' => 'processing',
        'processing' => 'shipped',
        'shipped' => 'completed',
        _ => null,
      };

  String get nextStatusLabel => switch (status) {
        'pending' => 'Start preparing',
        'processing' => 'Mark shipped',
        'shipped' => 'Mark delivered',
        _ => '',
      };

  factory VendorOrderLine.fromJson(Map<String, dynamic> json) {
    final customer = (json['customer'] as Map?) ?? const {};
    final product = json['product'] as Map?;

    return VendorOrderLine(
      id: (json['id'] as num?)?.toInt() ?? 0,
      reference: '${json['reference'] ?? ''}',
      status: '${json['status'] ?? 'pending'}',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toDouble() ?? 0,
      customerName: '${customer['name'] ?? 'Customer'}',
      customerPhone: customer['phone'] as String?,
      address: json['address'] as String?,
      productName: product?['name'] as String?,
      productImage: product?['image'] as String?,
    );
  }
}
