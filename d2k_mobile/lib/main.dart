import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await _initialiseFirebase();

  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
  ));
  runApp(const D2KApp());
}

/// Brings up Firebase if this build was given its configuration.
///
/// Firebase is used for one thing — Google sign-in — and the rest of the
/// marketplace does not depend on it. So a build without `google-services.json`
/// (or without the iOS plist) starts normally and simply has no Google button,
/// rather than refusing to launch. `AuthController` checks `Firebase.apps`
/// before offering the flow.
Future<void> _initialiseFirebase() async {
  if (Firebase.apps.isNotEmpty) return;

  try {
    // Options come from the native config files the FlutterFire CLI installs.
    await Firebase.initializeApp();
  } catch (error) {
    // Not fatal: the app is a marketplace first and a Firebase client second.
    debugPrint('Firebase not configured — Google sign-in disabled. ($error)');
  }
}
