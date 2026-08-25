import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_exception.dart';
import '../core/storage/token_store.dart';
import '../models/account.dart';
import '../services/auth_service.dart';
import '../services/firebase_identity.dart';
import 'core.dart';

/// Who is signed in, if anyone.
class SessionState {
  const SessionState({this.user, this.restoring = true});

  final AuthUser? user;

  /// True until the stored token has been checked. Screens that gate on
  /// sign-in wait for this rather than flashing a signed-out state at somebody
  /// who is signed in.
  final bool restoring;

  bool get isSignedIn => user != null;

  SessionState copyWith({AuthUser? user, bool? restoring, bool clearUser = false}) => SessionState(
        user: clearUser ? null : (user ?? this.user),
        restoring: restoring ?? this.restoring,
      );
}

class SessionController extends StateNotifier<SessionState> {
  SessionController(this._auth, this._tokens) : super(const SessionState());

  final AuthService _auth;
  final TokenStore _tokens;

  /// Restores a session from the keychain.
  ///
  /// The cached profile is applied first so the app opens signed in on the
  /// very first frame, then `/api/me` confirms it in the background. If the
  /// token has been revoked the interceptor clears it and [forget] runs.
  Future<void> restore() async {
    final token = await _tokens.read();

    if (token == null || token.isEmpty) {
      state = const SessionState(restoring: false);
      return;
    }

    final cached = await _tokens.readUser();
    if (cached != null) {
      try {
        state = state.copyWith(
          user: AuthUser.fromJson(jsonDecode(cached) as Map<String, dynamic>),
        );
      } on Object {
        /* a corrupt cache is simply not used */
      }
    }

    try {
      final user = await _auth.me();
      await _tokens.writeUser(jsonEncode(user.toJson()));
      state = SessionState(user: user, restoring: false);
    } on ApiException catch (error) {
      // A revoked token means signed out. A flat network means "we don't know
      // yet" — keep the cached profile rather than throwing somebody out of
      // their account because a lift had no signal.
      if (error.isUnauthenticated) {
        await _tokens.clear();
        state = const SessionState(restoring: false);
      } else {
        state = state.copyWith(restoring: false);
      }
    }
  }

  Future<AuthUser> login({required String email, required String password}) =>
      _adopt(() => _auth.login(email: email, password: password));

  /// Creates the account **without signing in**.
  ///
  /// `/api/register` does hand back a Sanctum token, and it is deliberately
  /// discarded — the website's own `signUp` is documented as "creates the
  /// account without signing in", and returns the shopper to the login half
  /// with "Account created. Sign in to continue." Adopting the token here
  /// would give the phone a different session model from the browser for the
  /// same account, and would skip the one deliberate moment a new customer
  /// confirms the password they just chose.
  Future<void> createAccount({
    required String name,
    required String email,
    required String phone,
    required String password,
    required String passwordConfirmation,
  }) async {
    await _auth.register(
      name: name,
      email: email,
      phone: phone,
      password: password,
      passwordConfirmation: passwordConfirmation,
    );
  }

  /// Google: Firebase proves who they are, Laravel decides what that means.
  ///
  /// Returns null when the customer dismissed the account picker, which is not
  /// an error and must not be reported as one.
  Future<AuthUser?> signInWithGoogle() async {
    final idToken = await FirebaseIdentity.instance.googleIdToken();
    if (idToken == null) return null;
    return _adopt(() => _auth.google(idToken));
  }

  Future<AuthUser> _adopt(Future<AuthSession> Function() call) async {
    final session = await call();
    await _tokens.write(session.token);
    await _tokens.writeUser(jsonEncode(session.user.toJson()));
    state = SessionState(user: session.user, restoring: false);
    return session.user;
  }

  Future<void> refresh() async {
    if (!state.isSignedIn) return;
    try {
      final user = await _auth.me();
      await _tokens.writeUser(jsonEncode(user.toJson()));
      state = state.copyWith(user: user);
    } on ApiException {
      /* the interceptor already handled a 401 */
    }
  }

  Future<void> logout() async {
    try {
      await _auth.logout();
    } on ApiException {
      // Signing out locally must succeed even if the server cannot be reached.
    }
    await FirebaseIdentity.instance.signOut();
    await _tokens.clear();
    state = const SessionState(restoring: false);
  }

  /// Called when the server rejects the stored token mid-session.
  void forget() {
    if (state.user != null || state.restoring) {
      state = const SessionState(restoring: false);
    }
  }
}

final sessionProvider = StateNotifierProvider<SessionController, SessionState>((ref) {
  final controller = SessionController(
    ref.watch(authServiceProvider),
    ref.watch(tokenStoreProvider),
  );
  // A 401 anywhere drops the signed-in user once, centrally, instead of every
  // call site having to notice.
  ref.read(apiClientProvider).onUnauthenticated = controller.forget;
  return controller;
});

final currentUserProvider = Provider<AuthUser?>((ref) => ref.watch(sessionProvider).user);

final isSignedInProvider = Provider<bool>((ref) => ref.watch(sessionProvider).isSignedIn);
