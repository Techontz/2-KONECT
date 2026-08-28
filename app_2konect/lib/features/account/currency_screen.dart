import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/tokens.dart';
import '../../providers/currency.dart';
import '../../providers/language.dart';

/// Choosing the currency prices are shown in.
///
/// The change is immediate and total: every price on every screen is refetched
/// from the server in the new currency. The app converts nothing — it asks, and
/// the server answers at the rate 2KONECT's administrators set.
///
/// A choice made here outlives the country the handset is in. Somebody in Dar
/// es Salaam who picks dollars keeps dollars, on this run and every one after,
/// until they come back and change it.
class CurrencyScreen extends ConsumerWidget {
  const CurrencyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(currencyControllerProvider).currency;

    return Scaffold(
      appBar: AppBar(title: Text(ref.t('currency.label'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
        children: [
          Text(
            ref.t('currency.choose'),
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: K.s4),
          Text(
            ref.t('currency.subtitle'),
            style: const TextStyle(fontSize: 13, height: 1.5, color: K.inkMuted),
          ),
          const SizedBox(height: K.s20),
          for (final currency in AppCurrency.values)
            CurrencyRow(
              currency: currency,
              selected: currency == current,
              onTap: () => ref.read(currencyControllerProvider.notifier).set(currency),
            ),
          const SizedBox(height: K.gutter),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline_rounded, size: 14, color: K.inkFaint),
              const SizedBox(width: K.s8),
              Expanded(
                child: Text(
                  ref.t('currency.chargeNote'),
                  style: const TextStyle(fontSize: 11.5, height: 1.5, color: K.inkFaint),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class CurrencyRow extends StatelessWidget {
  const CurrencyRow({
    super.key,
    required this.currency,
    required this.selected,
    required this.onTap,
  });

  final AppCurrency currency;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: K.s8),
      child: Material(
        color: selected ? K.brand50 : K.surface,
        borderRadius: BorderRadius.circular(K.rSm),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(K.rSm),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(K.rSm),
              border: Border.all(color: selected ? K.brand : K.line, width: selected ? 1.5 : 1),
            ),
            child: Row(
              children: [
                Text(currency.flag, style: const TextStyle(fontSize: 22)),
                const SizedBox(width: K.s12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        currency.code,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        currency.label,
                        style: const TextStyle(fontSize: 12, color: K.inkMuted),
                      ),
                    ],
                  ),
                ),
                if (selected)
                  const Icon(Icons.check_circle_rounded, size: 20, color: K.brand),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
