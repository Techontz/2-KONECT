import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/l10n/strings.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/tokens.dart';
import 'providers/core.dart';
import 'providers/language.dart';
import 'providers/session.dart';
import 'services/firebase_identity.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Portrait only. A commerce grid designed around a thumb does not become a
  // better experience rotated, and locking it removes a whole class of layout
  // failure rather than papering over it.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Opened before the first frame so language and basket are available
  // synchronously — the app must never open in English and then swap.
  final preferences = await SharedPreferences.getInstance();

  // Never throws: a build without per-platform Firebase configuration simply
  // does not offer Google sign-in.
  await FirebaseIdentity.instance.initialise();

  runApp(
    ProviderScope(
      overrides: [preferencesProvider.overrideWithValue(preferences)],
      child: const KonectApp(),
    ),
  );
}

class KonectApp extends ConsumerStatefulWidget {
  const KonectApp({super.key});

  @override
  ConsumerState<KonectApp> createState() => _KonectAppState();
}

class _KonectAppState extends ConsumerState<KonectApp> {
  @override
  void initState() {
    super.initState();
    // Restore the signed-in account before the first route is resolved, so a
    // protected deep link does not bounce somebody who is already signed in.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(sessionProvider.notifier).restore();
    });
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(languageProvider).language;

    return MaterialApp.router(
      title: '2KONECT',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.build(),
      routerConfig: ref.watch(routerProvider),
      locale: language.locale,
      supportedLocales: AppLanguage.values.map((l) => l.locale),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      // Kiswahili has no Material translation bundle, so the framework would
      // otherwise refuse the locale outright. English is the right fallback
      // for the handful of framework-owned strings; every string 2KONECT
      // itself renders comes from our own dictionaries and is translated.
      localeResolutionCallback: (_, _) => language.locale,
      builder: (context, child) {
        // A commerce surface is light and its type must not be blown up past
        // the point the layouts survive. Clamped, not ignored.
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: media.textScaler.clamp(minScaleFactor: 0.9, maxScaleFactor: 1.3),
          ),
          child: ColoredBox(color: K.canvas, child: child ?? const SizedBox.shrink()),
        );
      },
    );
  }
}
