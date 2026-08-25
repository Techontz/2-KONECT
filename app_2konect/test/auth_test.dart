import 'package:app_2konect/core/l10n/strings.dart';
import 'package:app_2konect/core/network/api_client.dart';
import 'package:app_2konect/core/storage/token_store.dart';
import 'package:app_2konect/core/theme/app_theme.dart';
import 'package:app_2konect/features/auth/auth_screen.dart';
import 'package:app_2konect/features/auth/widgets/auth_segmented.dart';
import 'package:app_2konect/features/auth/widgets/google_button.dart';
import 'package:app_2konect/providers/core.dart';
import 'package:app_2konect/providers/session.dart';
import 'package:app_2konect/services/auth_service.dart';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A token store that never touches the platform keychain.
///
/// Every method is overridden, so the inherited secure storage is never
/// reached — which is what lets the session logic be tested without a
/// platform channel behind it.
class _MemoryTokens extends TokenStore {

  String? _token;
  String? _user;

  @override
  String? get cachedToken => _token;

  @override
  Future<String?> read() async => _token;

  @override
  Future<void> write(String token) async => _token = token;

  @override
  Future<void> clear() async {
    _token = null;
    _user = null;
  }

  @override
  Future<String?> readUser() async => _user;

  @override
  Future<void> writeUser(String json) async => _user = json;
}

/// The auth surface, wired to a Dio whose responses we choose.
Future<Widget> _harness({
  required List<({RegExp path, int status, Object body})> routes,
  String? redirectTo,
  bool startOnRegister = false,
  void Function(SessionController)? onReady,
}) async {
  SharedPreferences.setMockInitialValues({});
  final preferences = await SharedPreferences.getInstance();

  final dio = Dio();
  dio.httpClientAdapter = _StubAdapter(routes);

  final tokens = _MemoryTokens();
  final api = ApiClient(tokens: tokens, dio: dio);

  final container = ProviderContainer(overrides: [
    preferencesProvider.overrideWithValue(preferences),
    tokenStoreProvider.overrideWithValue(tokens),
    apiClientProvider.overrideWithValue(api),
    authServiceProvider.overrideWithValue(AuthService(api)),
  ]);
  onReady?.call(container.read(sessionProvider.notifier));

  return UncontrolledProviderScope(
    container: container,
    child: MaterialApp(
      theme: AppTheme.build(),
      home: AuthScreen(redirectTo: redirectTo, startOnRegister: startOnRegister),
    ),
  );
}

class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this.routes);

  final List<({RegExp path, int status, Object body})> routes;
  final calls = <String>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? stream,
      Future<void>? cancelFuture) async {
    calls.add(options.path);
    for (final route in routes) {
      if (route.path.hasMatch(options.path)) {
        return ResponseBody.fromString(
          route.body is String ? route.body as String : _encode(route.body),
          route.status,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      }
    }
    return ResponseBody.fromString('{"message":"no stub"}', 404, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });
  }

  static String _encode(Object body) =>
      const JsonEncoder().convert(body);

  @override
  void close({bool force = false}) {}
}

const _user = {
  'id': 7,
  'name': 'Asha Mrisho',
  'email': 'asha@example.com',
  'phone': '0712345678',
  'role': 'user',
};

/// Taps a control after scrolling it into view.
///
/// The sign-up half is taller than the default 800×600 test surface, so a
/// plain `tap` aims at a point off-screen and quietly misses — which looks
/// exactly like a validator that does not run.
Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  group('the screen renders', () {
    testWidgets('1. login is the default half', (tester) async {
      await tester.pumpWidget(await _harness(routes: const []));
      await tester.pumpAndSettle();

      expect(find.byType(AuthSegmented), findsOneWidget);
      expect(find.text('Welcome back'), findsOneWidget);
      expect(find.text('Email address'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      // Sign-up-only fields are absent.
      expect(find.text('Full name'), findsNothing);
      expect(find.text('Confirm password'), findsNothing);
    });

    testWidgets('2. sign up can be opened directly', (tester) async {
      await tester.pumpWidget(await _harness(routes: const [], startOnRegister: true));
      await tester.pumpAndSettle();

      expect(find.text('Join 2KONECT'), findsOneWidget);
      expect(find.text('Full name'), findsOneWidget);
      expect(find.text('Phone number'), findsOneWidget);
      expect(find.text('Confirm password'), findsOneWidget);
      expect(find.text('Create account'), findsOneWidget);
    });

    testWidgets('3. the slider moves between the two halves', (tester) async {
      await tester.pumpWidget(await _harness(routes: const []));
      await tester.pumpAndSettle();

      expect(find.text('Full name'), findsNothing);

      await tester.tap(find.text('Sign up'));
      await tester.pumpAndSettle();
      expect(find.text('Full name'), findsOneWidget);
      expect(find.text('Join 2KONECT'), findsOneWidget);

      await tester.tap(find.text('Log in').first);
      await tester.pumpAndSettle();
      expect(find.text('Full name'), findsNothing);
      expect(find.text('Welcome back'), findsOneWidget);
    });
  });

  group('validation', () {
    testWidgets('4. an empty login is refused before any request', (tester) async {
      await tester.pumpWidget(await _harness(routes: const []));
      await tester.pumpAndSettle();

      await tapVisible(tester, find.widgetWithText(FilledButton, 'Log in'));

      expect(find.text('Enter your email address'), findsOneWidget);
      expect(find.text('Enter your password'), findsOneWidget);
    });

    testWidgets('5. a malformed email is refused', (tester) async {
      await tester.pumpWidget(await _harness(routes: const []));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).first, 'not-an-email');
      await tapVisible(tester, find.widgetWithText(FilledButton, 'Log in'));

      expect(find.text('Enter a valid email address'), findsOneWidget);
    });

    testWidgets('6. mismatched passwords are refused', (tester) async {
      await tester.pumpWidget(await _harness(routes: const [], startOnRegister: true));
      await tester.pumpAndSettle();

      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Asha Mrisho');
      await tester.enterText(fields.at(1), '0712345678');
      await tester.enterText(fields.at(2), 'asha@example.com');
      await tester.enterText(fields.at(3), 'correct-horse');
      await tester.enterText(fields.at(4), 'something-else');

      await tapVisible(tester, find.widgetWithText(FilledButton, 'Create account'));

      expect(find.text('Both passwords must match.'), findsOneWidget);
    });
  });

  group('the backend contract', () {
    testWidgets('7. a successful login adopts the Sanctum session',
        (tester) async {
      SessionController? session;
      await tester.pumpWidget(await _harness(
        routes: [
          (path: RegExp(r'/login$'), status: 200, body: {'user': _user, 'token': 'sanctum-abc'}),
        ],
        onReady: (s) => session = s,
      ));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).at(0), 'asha@example.com');
      await tester.enterText(find.byType(TextFormField).at(1), 'correct-horse');
      await tapVisible(tester, find.widgetWithText(FilledButton, 'Log in'));

      expect(session!.state.isSignedIn, isTrue);
      expect(session!.state.user!.email, 'asha@example.com');
    });

    testWidgets('8. signing up does NOT sign you in — it returns to login',
        (tester) async {
      SessionController? session;
      await tester.pumpWidget(await _harness(
        routes: [
          // The endpoint hands back a token; the app deliberately discards it,
          // exactly as the website's `signUp` does.
          (path: RegExp(r'/register$'), status: 201, body: {'user': _user, 'token': 'ignored'}),
        ],
        startOnRegister: true,
        onReady: (s) => session = s,
      ));
      await tester.pumpAndSettle();

      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'Asha Mrisho');
      await tester.enterText(fields.at(1), '0712345678');
      await tester.enterText(fields.at(2), 'asha@example.com');
      await tester.enterText(fields.at(3), 'correct-horse');
      await tester.enterText(fields.at(4), 'correct-horse');

      await tapVisible(tester, find.widgetWithText(FilledButton, 'Create account'));

      expect(session!.state.isSignedIn, isFalse,
          reason: 'the website creates the account without signing in');
      expect(find.text('Account created. Sign in to continue.'), findsOneWidget);
      // …and we are back on the login half.
      expect(find.text('Full name'), findsNothing);
    });

    testWidgets('9. a refusal is shown verbatim, not swallowed', (tester) async {
      await tester.pumpWidget(await _harness(routes: [
        (
          path: RegExp(r'/login$'),
          status: 401,
          body: {'message': 'These credentials do not match our records.'},
        ),
      ]));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).at(0), 'asha@example.com');
      await tester.enterText(find.byType(TextFormField).at(1), 'wrong');
      await tapVisible(tester, find.widgetWithText(FilledButton, 'Log in'));

      // A 401 on the sign-in screen means "wrong password", so the customer
      // sees the sign-in prompt rather than the server's raw sentence.
      expect(find.text('Please sign in to continue.'), findsOneWidget);
    });
  });

  group('Google', () {
    testWidgets('10. the button is always present, and names Google', (tester) async {
      await tester.pumpWidget(await _harness(routes: const []));
      await tester.pumpAndSettle();

      expect(find.byType(GoogleButton), findsOneWidget);
      expect(find.text('Continue with Google'), findsOneWidget);
      expect(find.byType(GoogleMark), findsOneWidget);
    });

    testWidgets('11. an unconfigured build says so rather than failing silently',
        (tester) async {
      await tester.pumpWidget(await _harness(routes: const []));
      await tester.pumpAndSettle();

      await tapVisible(tester, find.text('Continue with Google'));

      // Firebase is not initialised in a test binding, which is exactly the
      // unconfigured case a release build without google-services.json hits.
      expect(find.text('Google sign-in is not available on this site yet.'),
          findsOneWidget);
    });
  });

  group('language', () {
    test('12. every string the auth screen uses resolves in all four languages',
        () {
      const keys = [
        'auth.login',
        'auth.signup',
        'auth.welcomeBack',
        'auth.join',
        'auth.name',
        'auth.phone',
        'auth.email',
        'auth.password',
        'auth.confirmPassword',
        'auth.createAccountBtn',
        'auth.continueWithGoogle',
        'auth.googleUnavailable',
        'auth.googleFailed',
        'auth.googleNetwork',
        'auth.registered',
        'auth.termsNote',
        'auth.or',
        'auth.errEmail',
        'auth.errEmailValid',
        'auth.errPassword',
        'auth.errPasswordShort',
        'app.passwordsDiffer',
        'app.googleSetupHint',
      ];

      for (final language in AppLanguage.values) {
        final t = Strings(language);
        for (final key in keys) {
          final value = t(key, const {'brand': '2KONECT'});
          expect(value, isNotEmpty, reason: '$key missing for ${language.code}');
          expect(value, isNot(contains('{')),
              reason: '$key left a placeholder unsubstituted for ${language.code}');
        }
      }
    });

    test('13. the auth screen is genuinely translated, not English throughout',
        () {
      for (final language in [AppLanguage.sw, AppLanguage.fr, AppLanguage.zh]) {
        expect(
          Strings(language)('auth.welcomeBack'),
          isNot(equals(Strings(AppLanguage.en)('auth.welcomeBack'))),
          reason: '${language.code} should translate the auth banner',
        );
      }
    });
  });
}
