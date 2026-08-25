import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/account_screen.dart';
import '../../features/account/addresses_screen.dart';
import '../../features/account/language_screen.dart';
import '../../features/auth/auth_screen.dart';
import '../../features/cart/cart_screen.dart';
import '../../features/categories/categories_screen.dart';
import '../../features/categories/category_screen.dart';
import '../../features/chat/chat_screen.dart';
import '../../features/chat/threads_screen.dart';
import '../../features/checkout/checkout_screen.dart';
import '../../features/delivery/deliveries_screen.dart';
import '../../features/delivery/request_delivery_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/orders/order_screen.dart';
import '../../features/orders/orders_screen.dart';
import '../../features/payment/pay_screen.dart';
import '../../features/products/listing_screen.dart';
import '../../features/products/product_screen.dart';
import '../../features/requests/request_form_screen.dart';
import '../../features/requests/requests_screen.dart';
import '../../features/search/search_screen.dart';
import '../../features/seller/seller_apply_screen.dart';
import '../../features/seller/seller_dashboard_screen.dart';
import '../../features/seller/seller_orders_screen.dart';
import '../../features/seller/seller_products_screen.dart';
import '../../features/seller/seller_status_screen.dart';
import '../../features/vendors/vendors_screen.dart';
import '../../features/wishlist/wishlist_screen.dart';
import '../../providers/session.dart';
import '../../widgets/app_shell.dart';
import '../../models/common.dart';

/// Every route in the app.
///
/// The five destinations that matter live in a `StatefulShellRoute` so each
/// tab keeps its own scroll position and history — switching to Cart and back
/// must not throw away where somebody was in a 3,000-product grid.
///
/// Anything that genuinely needs an account is listed in [_protected]. Opening
/// one signed out sends the customer through sign-in and then **back to where
/// they were going**, rather than dumping them on the home screen.
const _protected = <String>[
  '/checkout',
  '/orders',
  '/messages',
  '/addresses',
  '/deliveries',
  '/seller',
];

bool _needsAccount(String location) =>
    _protected.any((path) => location == path || location.startsWith('$path/'));

final rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/',
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      // Until the stored token has been checked we do not know who this is;
      // bouncing now would sign out somebody who is actually signed in.
      if (session.restoring) return null;

      final location = state.matchedLocation;
      if (session.isSignedIn || !_needsAccount(location)) return null;

      final target = Uri.encodeComponent(state.uri.toString());
      return '/auth?redirect=$target';
    },
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/shop',
              builder: (context, state) {
                final query = state.uri.queryParameters;
                return ListingScreen(
                  title: query['title'],
                  availability: _availability(query['availability']),
                  categoryId: int.tryParse(query['category'] ?? ''),
                  subcategoryId: int.tryParse(query['subcategory'] ?? ''),
                  vendorId: int.tryParse(query['vendor'] ?? ''),
                  term: query['q'],
                  onSale: query['on_sale'] == '1',
                  verified: query['verified'] == '1',
                );
              },
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/cart', builder: (_, _) => const CartScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/orders', builder: (_, _) => const OrdersScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/account', builder: (_, _) => const AccountScreen()),
          ]),
        ],
      ),

      /* ---- pushed over the shell ---- */
      GoRoute(
        path: '/product/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) =>
            ProductScreen(productId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0),
      ),
      GoRoute(
        path: '/categories',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const CategoriesScreen(),
      ),
      GoRoute(
        path: '/category/:id',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => CategoryScreen(
          categoryId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
          name: state.uri.queryParameters['name'],
        ),
      ),
      GoRoute(
        path: '/search',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => SearchScreen(initialTerm: state.uri.queryParameters['q']),
      ),
      GoRoute(
        path: '/wishlist',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const WishlistScreen(),
      ),
      GoRoute(
        path: '/vendors',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const VendorsScreen(),
      ),
      GoRoute(
        path: '/checkout',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const CheckoutScreen(),
      ),
      GoRoute(
        path: '/orders/:reference',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) =>
            OrderScreen(reference: state.pathParameters['reference'] ?? ''),
      ),
      GoRoute(
        path: '/pay/:reference',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => PayScreen(reference: state.pathParameters['reference'] ?? ''),
      ),
      GoRoute(
        path: '/deliveries',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const DeliveriesScreen(),
      ),
      GoRoute(
        path: '/deliveries/new/:reference',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) =>
            RequestDeliveryScreen(orderReference: state.pathParameters['reference'] ?? ''),
      ),
      GoRoute(
        path: '/requests',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const RequestsScreen(),
      ),
      GoRoute(
        path: '/request',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) =>
            RequestFormScreen(prefillTerm: state.uri.queryParameters['q']),
      ),
      GoRoute(
        path: '/messages',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const ThreadsScreen(),
      ),
      GoRoute(
        path: '/messages/:userId',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => ChatScreen(
          userId: int.tryParse(state.pathParameters['userId'] ?? '') ?? 0,
          name: state.uri.queryParameters['name'],
          vendorId: int.tryParse(state.uri.queryParameters['vendor'] ?? ''),
          productId: int.tryParse(state.uri.queryParameters['product'] ?? ''),
        ),
      ),
      GoRoute(
        path: '/addresses',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const AddressesScreen(),
      ),
      GoRoute(
        path: '/language',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const LanguageScreen(),
      ),
      GoRoute(
        path: '/sell',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const SellerApplyScreen(),
      ),
      GoRoute(
        path: '/seller',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const SellerDashboardScreen(),
      ),
      GoRoute(
        path: '/seller/products',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const SellerProductsScreen(),
      ),
      GoRoute(
        path: '/seller/orders',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const SellerOrdersScreen(),
      ),
      GoRoute(
        path: '/seller/store',
        parentNavigatorKey: rootNavigatorKey,
        builder: (_, _) => const SellerStatusScreen(),
      ),
      GoRoute(
        path: '/auth',
        parentNavigatorKey: rootNavigatorKey,
        builder: (context, state) => AuthScreen(
          redirectTo: state.uri.queryParameters['redirect'],
          startOnRegister: state.uri.queryParameters['mode'] == 'register',
        ),
      ),
    ],
    errorBuilder: (context, state) => const _RouteNotFound(),
  );
});

Availability? _availability(String? value) {
  if (value == null) return null;
  return value == 'import' ? Availability.import : Availability.local;
}

class _RouteNotFound extends StatelessWidget {
  const _RouteNotFound();

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('2KONECT')),
        body: Center(
          child: TextButton(
            onPressed: () => context.go('/'),
            child: const Text('Go home'),
          ),
        ),
      );
}
