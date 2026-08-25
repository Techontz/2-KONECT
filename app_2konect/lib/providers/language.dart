import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/l10n/strings.dart';
import 'core.dart';

/// The chosen language, and whether the customer has actually chosen one.
class LanguageState {
  const LanguageState({required this.language, required this.chosen});

  final AppLanguage language;

  /// False until the customer picks one for themselves. The first-run sheet is
  /// shown on that, not on "the language happens to be English" — a Tanzanian
  /// handset already set to Kiswahili opens in Kiswahili and is still asked
  /// once, so the choice is theirs rather than inferred.
  final bool chosen;
}

/// The single translation system, mirroring `2k-web/lib/i18n`.
///
/// Deliberately not a second one alongside Flutter's own `intl` delegates: the
/// wording is generated from the website's dictionaries and looked up by the
/// same dotted keys, so a phrase exists once for both surfaces.
class LanguageController extends StateNotifier<LanguageState> {
  LanguageController(this._prefs)
      : super(_initial(_prefs));

  final SharedPreferences _prefs;

  static const _key = '2konect.language';
  static const _chosenKey = '2konect.language.chosen';

  static LanguageState _initial(SharedPreferences prefs) {
    final stored = AppLanguage.parse(prefs.getString(_key));
    if (stored != null) {
      return LanguageState(language: stored, chosen: prefs.getBool(_chosenKey) ?? true);
    }

    // Nothing stored: start in the handset's own language when we ship it, so
    // the very first frame is already right rather than English-then-swap.
    final device = AppLanguage.forLocale(
      PlatformDispatcher.instance.locale,
    );
    return LanguageState(language: device ?? AppLanguage.fallback, chosen: false);
  }

  void set(AppLanguage language) {
    state = LanguageState(language: language, chosen: true);
    _prefs.setString(_key, language.code);
    _prefs.setBool(_chosenKey, true);
  }

  /// Dismissing the first-run sheet keeps the current language but stops
  /// asking — the customer chose by declining to change it.
  void confirmCurrent() => set(state.language);
}

final languageProvider = StateNotifierProvider<LanguageController, LanguageState>(
  (ref) => LanguageController(ref.watch(preferencesProvider)),
);

/// `t('cart.title')` — the translator for the current language.
final tProvider = Provider<Strings>(
  (ref) => Strings(ref.watch(languageProvider).language),
);

/// `ref.t('cart.title')` at any call site, so a screen never has to remember
/// to watch the translator separately from using it.
extension TranslateRef on WidgetRef {
  Strings get strings => watch(tProvider);

  String t(String key, [Map<String, Object?> values = const {}]) =>
      watch(tProvider)(key, values);
}
