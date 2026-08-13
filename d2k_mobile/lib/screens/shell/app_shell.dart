import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../state/app_controllers.dart';
import '../../state/auth_controller.dart';
import '../../widgets/bottom_nav.dart';
import '../account/account_screen.dart';
import '../cart/cart_screen.dart';
import '../categories/categories_screen.dart';
import '../deals/deals_screen.dart';
import '../home/home_screen.dart';

/// Persistent five-tab shell. Each tab keeps its own navigator so a product
/// page opened from Home does not reset when the shopper checks the cart.
class AppShell extends StatefulWidget {
  const AppShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  static _AppShellState? _of(BuildContext context) =>
      context.findAncestorStateOfType<_AppShellState>();

  /// Switch tabs from anywhere (e.g. "Start Shopping" in the empty cart).
  static void go(BuildContext context, int index) => _of(context)?.select(index);

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late int _index = widget.initialIndex;

  @override
  void initState() {
    super.initState();
    // Once a session is available, pull the account's saved addresses so
    // checkout can offer the same delivery details the website has.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (context.read<AuthController>().isAuthenticated) {
        context.read<LocationController>().loadAddresses();
      }
    });
  }

  final List<GlobalKey<NavigatorState>> _navigatorKeys =
      List.generate(5, (_) => GlobalKey<NavigatorState>());

  void select(int index) {
    if (index == _index) {
      _navigatorKeys[index].currentState?.popUntil((r) => r.isFirst);
      return;
    }
    setState(() => _index = index);
  }

  Widget _tab(int index, Widget child) {
    return Navigator(
      key: _navigatorKeys[index],
      onGenerateRoute: (settings) => MaterialPageRoute(
        settings: settings,
        builder: (_) => child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        final navigator = _navigatorKeys[_index].currentState;
        if (navigator != null && navigator.canPop()) {
          navigator.pop();
        } else if (_index != 0) {
          setState(() => _index = 0);
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.surface,
        body: IndexedStack(
          index: _index,
          children: [
            _tab(0, const HomeScreen()),
            _tab(1, const CategoriesScreen()),
            _tab(2, const DealsScreen()),
            _tab(3, const AccountScreen()),
            _tab(4, const CartScreen()),
          ],
        ),
        bottomNavigationBar: D2KBottomNav(index: _index, onSelect: select),
      ),
    );
  }
}
