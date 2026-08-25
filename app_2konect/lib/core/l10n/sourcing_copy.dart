import '../../models/common.dart';
import 'strings.dart';

/// The sourcing copy, said in the reader's language.
///
/// The API sends these lines already written — "In Tanzania", "Available in
/// Tanzania", "In stock locally and ready to ship." — which is fine while the
/// storefront is English and wrong the moment it is not: the screen around
/// them turns Kiswahili and they do not.
///
/// Every one of them is derivable from structured fields the same payload
/// already carries (`is_local`, `origin`, `lead_time.min/max`,
/// `shipping_method.code`), so they are rebuilt here rather than translated on
/// the server. That keeps the API contract untouched — no deployment is needed
/// for the app to speak a new language — and the server's own string stays as
/// the fallback if a shape ever turns up that this does not know.
///
/// This mirrors `2k-web/components/sourcing/Availability.tsx` exactly, so the
/// phone and the website say the same sentence in every language.
extension SourcingCopy on Sourcing {
  /// The short form, for a card's availability band and a compact badge.
  String labelIn(Strings t, String homeCountry) => isLocal
      ? t('product.sourceLabelLocal', {'country': destination?.name ?? homeCountry})
      : t('product.sourceLabelImport');

  /// The long form, for a product page.
  String headlineIn(Strings t, String homeCountry) {
    if (isLocal) {
      return t('product.headlineLocal', {'country': destination?.name ?? homeCountry});
    }
    final from = origin?.name;
    return from == null
        ? t('product.headlineIntl')
        : t('product.headlineFrom', {'country': from});
  }

  String summaryIn(Strings t) =>
      t(isLocal ? 'product.summaryLocal' : 'product.summaryImport');

  /// "1–3 days" / "3 days" / "1 day", built from the numbers rather than from
  /// the server's pre-composed English string.
  String leadTimeIn(Strings t) {
    final lead = leadTime;
    if (lead.label.isEmpty) return '';
    if (lead.min != lead.max) {
      return t('product.daysRange', {'min': lead.min, 'max': lead.max});
    }
    return lead.min == 1 ? t('product.dayOne') : t('product.daysExact', {'count': lead.min});
  }

  /// The freight mode, keyed off its code so the server's English is not shown.
  String? shippingMethodIn(Strings t) {
    final method = shippingMethod;
    if (method == null) return null;
    return switch (method.code) {
      'air' => t('product.methodAir'),
      'sea' => t('product.methodSea'),
      'road' => t('product.methodRoad'),
      // An unknown mode falls back to whatever the server called it, which is
      // better than saying nothing about how a shipment travels.
      _ => method.label,
    };
  }

  /// What a card's band names: the country for an import, the short label for
  /// local stock. Shorter than "Order from abroad", so it survives a 164px
  /// card without an ellipsis, and strictly more information.
  String bandPlaceIn(Strings t, String homeCountry) =>
      isLocal ? labelIn(t, homeCountry) : (origin?.name ?? labelIn(t, homeCountry));
}
