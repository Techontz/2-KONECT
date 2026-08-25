import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/tokens.dart';
import '../../../models/payment.dart';
import '../../../providers/language.dart';
import '../../../widgets/primitives.dart';

/// How this order may be paid for.
///
/// The list is the server's, not the app's. Cash on delivery appears only when
/// `cash_on_delivery` is true, which for a basket holding anything sourced
/// from abroad it never is — so on an import there is no COD row to disable,
/// grey out or explain away. It simply is not there.
///
/// The till number is likewise the server's. It changes without a release, an
/// administrator owns it, and a number compiled into an APK is a number that
/// is wrong the day it changes — wrong in a way that sends real money to
/// somebody else. When no channel is switched on, the customer is told that
/// plainly instead of being quietly dropped back to cash on delivery.
class PaymentPicker extends ConsumerWidget {
  const PaymentPicker({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  final PaymentOptions options;
  final String? selected;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // A prepaid basket with nothing configured cannot be paid at all. Saying
    // so is the only honest answer; falling back to COD would break the rule
    // the server exists to enforce.
    if (options.hasNoWayToPay) {
      return Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: K.warnSoft,
          borderRadius: K.radius(K.rSm),
          border: Border.all(color: K.warn.withValues(alpha: 0.3)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline_rounded, size: 17, color: K.warn),
            const SizedBox(width: K.s10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ref.t('payment.noChannels'),
                    style: const TextStyle(
                      fontSize: 12.5,
                      height: 1.5,
                      fontWeight: FontWeight.w600,
                      color: K.warn,
                    ),
                  ),
                  const SizedBox(height: K.s6),
                  Text(
                    ref.t('payment.codUnavailableAbroad'),
                    style: const TextStyle(fontSize: 11.5, height: 1.45, color: K.inkMuted),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        for (final channel in options.channels)
          _Method(
            code: channel.code,
            label: channel.label,
            note: channel.instructions ??
                (channel.code == PaymentChannel.lipaNamba
                    ? ref.t('payment.lipaNambaHint', {'brand': '2KONECT'})
                    : ref.t('payment.mobileMoneyHint')),
            icon: channel.code == PaymentChannel.lipaNamba
                ? Icons.store_mall_directory_rounded
                : Icons.smartphone_rounded,
            selected: selected == channel.code,
            onTap: () => onSelect(channel.code),
            // The till number is shown once the method is chosen, and again on
            // the payment screen. Never rendered from a constant.
            merchant: channel.merchantName,
          ),

        // Only ever offered when the server says it may be.
        if (options.cashOnDelivery)
          _Method(
            code: PaymentChannel.cashOnDelivery,
            label: ref.t('payment.cashOnDelivery'),
            note: ref.t('payment.cashOnDeliveryHint'),
            icon: Icons.payments_outlined,
            selected: selected == PaymentChannel.cashOnDelivery,
            onTap: () => onSelect(PaymentChannel.cashOnDelivery),
          ),

        if (options.requiresPrepayment) ...[
          const SizedBox(height: K.s4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.lock_outline_rounded, size: 13, color: K.inkFaint),
              const SizedBox(width: K.s6),
              Expanded(
                child: Text(
                  ref.t('payment.codUnavailableAbroad'),
                  style: const TextStyle(fontSize: 11, height: 1.45, color: K.inkFaint),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _Method extends StatelessWidget {
  const _Method({
    required this.code,
    required this.label,
    required this.note,
    required this.icon,
    required this.selected,
    required this.onTap,
    this.merchant,
  });

  final String code;
  final String label;
  final String note;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  final String? merchant;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Material(
        color: selected ? K.brand50 : K.surface,
        borderRadius: K.radius(K.rSm),
        child: InkWell(
          onTap: onTap,
          borderRadius: K.radius(K.rSm),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: K.radius(K.rSm),
              border: Border.all(
                color: selected ? K.brand : K.line,
                width: selected ? 1.5 : 1,
              ),
            ),
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            child: Row(
              children: [
                Icon(
                  selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                  size: 19,
                  color: selected ? K.brand : K.lineStrong,
                ),
                const SizedBox(width: K.s12),
                Icon(icon, size: 19, color: selected ? K.brand : K.inkMuted),
                const SizedBox(width: K.s10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: selected ? K.brand : K.ink,
                        ),
                      ),
                      const SizedBox(height: K.s2),
                      Text(
                        note,
                        style: const TextStyle(fontSize: 11.5, height: 1.4, color: K.inkMuted),
                      ),
                      if (selected && merchant != null && merchant!.isNotEmpty) ...[
                        const SizedBox(height: K.s4),
                        Tag(merchant!, tone: Tone.brand),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
