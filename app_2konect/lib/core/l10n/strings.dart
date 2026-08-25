import 'package:flutter/widgets.dart';

import 'dictionaries/en.dart';
import 'dictionaries/mobile.dart';
import 'dictionaries/fr.dart';
import 'dictionaries/sw.dart';
import 'dictionaries/zh.dart';

/// The four languages 2KONECT ships in — the same four the website ships,
/// in the same order, with English leading as the default.
///
/// 2KONECT sells into Tanzania and sources from China, the UAE, Türkiye and
/// beyond, so the interface has to be legible to a buyer in Dar and a supplier
/// in Shenzhen at the same time. Kiswahili stays one tap away for the market
/// the storefront serves first.
enum AppLanguage {
  en('English', 'English', '🇬🇧', Locale('en', 'GB')),
  sw('Kiswahili', 'Swahili', '🇹🇿', Locale('sw', 'TZ')),
  fr('Français', 'French', '🇫🇷', Locale('fr', 'FR')),
  zh('中文', 'Chinese', '🇨🇳', Locale('zh', 'CN'));

  const AppLanguage(this.label, this.english, this.flag, this.locale);

  /// The name in the language itself — how a speaker recognises their own.
  final String label;

  /// The English name, for the secondary line.
  final String english;
  final String flag;
  final Locale locale;

  String get code => name;

  static const fallback = AppLanguage.en;

  static AppLanguage? parse(String? code) {
    if (code == null) return null;
    for (final language in AppLanguage.values) {
      if (language.code == code) return language;
    }
    return null;
  }

  /// Best match for the device's own locale, so a Tanzanian handset set to
  /// Kiswahili opens in Kiswahili without being asked.
  static AppLanguage? forLocale(Locale locale) => parse(locale.languageCode);
}

/// Language ≠ currency.
///
/// Switching to French does not turn prices into euros: 2KONECT prices in TZS
/// because it sells in Tanzania, and the server sends the currency with every
/// figure. Nothing in this file touches money.
const Map<AppLanguage, Map<String, String>> _dictionaries = {
  AppLanguage.en: enDictionary,
  AppLanguage.sw: swDictionary,
  AppLanguage.fr: frDictionary,
  AppLanguage.zh: zhDictionary,
};

/// Looks up a translated string, and substitutes `{placeholders}`.
///
/// A missing key falls back to English rather than rendering the raw key, so a
/// gap reads as untranslated rather than as a bug — and in debug it is loud.
class Strings {
  const Strings(this.language);

  final AppLanguage language;

  String call(String key, [Map<String, Object?> values = const {}]) {
    final table = _dictionaries[language] ?? enDictionary;
    final supplement = mobileDictionaries[language.code] ?? mobileDictionaries['en']!;

    // The website's vocabulary first, then the handful of phrases only a phone
    // needs, then English as the last resort before humanising the key.
    var value = table[key] ??
        supplement[key] ??
        enDictionary[key] ??
        mobileDictionaries['en']![key];

    if (value == null) {
      assert(() {
        debugPrint('2KONECT i18n: missing key "$key"');
        return true;
      }());
      // The last segment, humanised, beats showing "cart.emptyTitle" to a
      // customer.
      return _humanise(key);
    }

    if (values.isEmpty) return value;

    values.forEach((name, replacement) {
      value = value!.replaceAll('{$name}', '$replacement');
    });
    return value!;
  }

  /// True when the key exists at all — used where a screen renders a section
  /// only if it has copy for it.
  bool has(String key) =>
      (_dictionaries[language] ?? enDictionary).containsKey(key) ||
      (mobileDictionaries[language.code] ?? const {}).containsKey(key);

  static String _humanise(String key) {
    final last = key.split('.').last;
    final spaced = last.replaceAllMapped(RegExp('([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}');
    return spaced.isEmpty ? key : spaced[0].toUpperCase() + spaced.substring(1);
  }
}
