import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether the handset believes it has a route to the network.
///
/// Advisory only: a captive Wi-Fi portal reports "connected" and still refuses
/// every request, which is why failures are handled at the request level too.
/// This exists so the app can say "you're offline" instead of "something went
/// wrong" when it genuinely knows better.
final connectivityProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();

  bool online(List<ConnectivityResult> results) =>
      results.any((r) => r != ConnectivityResult.none);

  yield online(await connectivity.checkConnectivity());
  yield* connectivity.onConnectivityChanged.map(online);
});

final isOfflineProvider = Provider<bool>((ref) {
  return ref.watch(connectivityProvider).maybeWhen(
        data: (online) => !online,
        orElse: () => false,
      );
});
