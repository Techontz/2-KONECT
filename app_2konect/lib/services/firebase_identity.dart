import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

/// Firebase Authentication, used exactly the way the website uses it.
///
/// Firebase is the identity provider and nothing more: it says who the shopper
/// is, then Laravel decides what that means for 2KONECT and issues the Sanctum
/// token the rest of the app already runs on. There is no second session
/// system, no Socialite, and no separate OAuth implementation — the mobile
/// flow ends at the same `POST /api/auth/google` the browser posts to.
///
/// ---- configuration ----
///
/// The web deployment carries its Firebase config in `NEXT_PUBLIC_*` variables
/// and hides the Google button when they are absent (`firebaseConfigured`).
/// The Android and iOS equivalents are `google-services.json` and
/// `GoogleService-Info.plist` — per-app registrations made in the Firebase
/// console, not values that can be written into this repository.
///
/// The button is nonetheless always shown here. Hiding it makes an unfinished
/// deployment look like a product decision, and leaves no way to tell the two
/// apart from the device. Instead [available] reports the truth and the button
/// answers plainly — "Google sign-in is not available on this site yet" — the
/// moment it is pressed. Drop the configuration file in and it starts working
/// with no code change.
class FirebaseIdentity {
  FirebaseIdentity._();

  static final FirebaseIdentity instance = FirebaseIdentity._();

  bool _initialised = false;
  bool _available = false;

  /// True once Firebase started successfully on this platform.
  bool get available => _available;

  /// Starts Firebase, tolerating a deployment that has not been given its
  /// per-platform configuration yet.
  ///
  /// Never throws: a missing `google-services.json` must degrade to
  /// "email and password only", not to a launch crash.
  Future<void> initialise() async {
    if (_initialised) return;
    _initialised = true;

    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      _available = true;
    } on Object catch (error) {
      // The overwhelmingly likely cause is that this platform has no Firebase
      // app registered. Recorded, not surfaced.
      _available = false;
      debugPrint('2KONECT: Firebase unavailable — Google sign-in disabled. ($error)');
    }
  }

  /// Signs in with Google and returns the Firebase **ID token**, which is what
  /// Laravel verifies. Null when the customer backed out of the sheet.
  ///
  /// The token is short-lived and audience-scoped to the Firebase project; it
  /// is never stored, only exchanged.
  Future<String?> googleIdToken() async {
    if (!_available) {
      throw const FirebaseIdentityUnavailable();
    }

    final google = GoogleSignIn(scopes: const ['email', 'profile']);

    // Sign out first so a customer who picked the wrong account once is not
    // silently locked into it forever.
    try {
      await google.signOut();
    } on Object {
      /* nothing to recover from — the picker still opens */
    }

    final account = await google.signIn();
    if (account == null) return null; // dismissed

    final auth = await account.authentication;
    final credential = GoogleAuthProvider.credential(
      idToken: auth.idToken,
      accessToken: auth.accessToken,
    );

    final result = await FirebaseAuth.instance.signInWithCredential(credential);
    return result.user?.getIdToken();
  }

  /// Ends the Firebase session. The Sanctum session is ended separately, by
  /// the API, because the two are genuinely different things.
  Future<void> signOut() async {
    if (!_available) return;
    try {
      await FirebaseAuth.instance.signOut();
      await GoogleSignIn().signOut();
    } on Object {
      /* signing out locally is best-effort */
    }
  }
}

/// Thrown when Google sign-in is asked for on a build that has no Firebase
/// configuration. The interface should never let this happen — the button is
/// hidden — so it exists to make a mistake loud rather than silent.
class FirebaseIdentityUnavailable implements Exception {
  const FirebaseIdentityUnavailable();

  @override
  String toString() => 'Google sign-in is not configured for this build.';
}
