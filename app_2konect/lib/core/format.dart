import 'package:intl/intl.dart';

/// Currency and date rendering, mirroring `2k-web/lib/format.ts`.
///
/// The API prices everything in the canonical currency and says so in
/// `price.currency`. Nothing in the app performs conversion arithmetic of its
/// own, and **language is not currency**: switching the interface to French
/// does not turn shillings into euros.
class Money {
  const Money._();

  /// Shilling amounts are quoted whole; decimals are noise.
  static final NumberFormat _whole = NumberFormat('#,##0', 'en_US');
  static final NumberFormat _decimal = NumberFormat('#,##0.00', 'en_US');

  /// `TZS 45,000` — the canonical way to render a price.
  static String format(num? amount, [String currency = 'TZS']) {
    if (amount == null) return '';
    return '$currency ${amountOnly(amount, currency)}';
  }

  /// The amount without the currency label, for tight card layouts.
  static String amountOnly(num? amount, [String currency = 'TZS']) {
    if (amount == null) return '';
    return currency == 'TZS' ? _whole.format(amount) : _decimal.format(amount);
  }

  /// `250K` / `2.5M` — short enough to sit on a filter chip.
  ///
  /// Exact rather than approximate: 2,500,000 renders as `2.5M`. Anything that
  /// would need more than one decimal to stay truthful keeps its full digits
  /// instead of being rounded into a number the catalogue does not contain.
  static String compact(num amount) {
    if (amount >= 1000000) {
      final millions = amount / 1000000;
      final rounded = (millions * 10).round() / 10;
      if ((rounded * 1000000 - amount).abs() < 0.5) {
        return '${_trim(rounded)}M';
      }
      return _whole.format(amount);
    }
    if (amount >= 1000) {
      final thousands = amount / 1000;
      final rounded = (thousands * 10).round() / 10;
      if ((rounded * 1000 - amount).abs() < 0.5) {
        return '${_trim(rounded)}K';
      }
      return _whole.format(amount);
    }
    return _whole.format(amount);
  }

  static String _trim(double value) =>
      value == value.roundToDouble() ? '${value.round()}' : '$value';

  /// Reads a figure the customer typed, tolerating spaces, commas and a
  /// currency label they pasted in. Returns the plain number the API wants —
  /// never the string.
  static double? parse(String input) {
    final digits = input.replaceAll(RegExp(r'[^0-9.]'), '');
    if (digits.isEmpty) return null;
    return double.tryParse(digits);
  }
}

class Dates {
  const Dates._();

  /// `12 Mar 2026` — unambiguous in every market 2KONECT ships to, which
  /// numeric formats are not.
  static String medium(DateTime? date, [String? locale]) {
    if (date == null) return '';
    return DateFormat('d MMM yyyy', locale).format(date);
  }

  static String withTime(DateTime? date, [String? locale]) {
    if (date == null) return '';
    return DateFormat('d MMM yyyy, HH:mm', locale).format(date);
  }

  static String timeOnly(DateTime? date, [String? locale]) {
    if (date == null) return '';
    return DateFormat('HH:mm', locale).format(date);
  }

  /// "2h", "3d" — for a message list, where the exact minute is noise.
  static String short(DateTime? date, [String? locale]) {
    if (date == null) return '';
    final delta = DateTime.now().difference(date);
    if (delta.inMinutes < 1) return 'now';
    if (delta.inMinutes < 60) return '${delta.inMinutes}m';
    if (delta.inHours < 24) return '${delta.inHours}h';
    if (delta.inDays < 7) return '${delta.inDays}d';
    return DateFormat('d MMM', locale).format(date);
  }
}
