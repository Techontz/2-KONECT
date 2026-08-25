import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/brand.dart';
import '../../../core/theme/tokens.dart';
import '../../../providers/language.dart';

/// The two ways to buy on 2KONECT, side by side, above everything else.
///
/// This is the whole proposition — stock that is already in Tanzania, and
/// stock we source from abroad — so it is stated once, plainly, before any
/// merchandising competes for the screen.
class QuickEntries extends ConsumerWidget {
  const QuickEntries({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _Entry(
                  icon: Icons.location_on_rounded,
                  title: ref.t('nav.inCountry', {'country': Brand.country}),
                  note: ref.t('nav.readyInDays'),
                  tint: K.localSoft,
                  edge: K.localLine,
                  colour: K.local,
                  onTap: () => context.push(
                    '/shop?availability=local&title=${Uri.encodeComponent(ref.read(tProvider)('nav.inCountry', {'country': Brand.country}))}',
                  ),
                ),
              ),
              const SizedBox(width: K.s10),
              Expanded(
                child: _Entry(
                  icon: Icons.flight_takeoff_rounded,
                  title: ref.t('nav.fromAbroad'),
                  note: ref.t('nav.lowerPriceImport'),
                  tint: K.importSoft,
                  edge: K.importLine,
                  colour: K.import,
                  onTap: () => context.push(
                    '/shop?availability=import&title=${Uri.encodeComponent(ref.read(tProvider)('nav.fromAbroad'))}',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: K.s10),
          Row(
            children: [
              Expanded(
                child: _Chip(
                  icon: Icons.category_outlined,
                  label: ref.t('nav.categories'),
                  onTap: () => context.push('/categories'),
                ),
              ),
              const SizedBox(width: K.s8),
              Expanded(
                child: _Chip(
                  icon: Icons.local_fire_department_outlined,
                  label: ref.t('nav.deals'),
                  onTap: () => context.push('/shop?on_sale=1'),
                ),
              ),
              const SizedBox(width: K.s8),
              Expanded(
                child: _Chip(
                  icon: Icons.storefront_outlined,
                  label: ref.t('footer.sellers'),
                  onTap: () => context.push('/vendors'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Entry extends StatelessWidget {
  const _Entry({
    required this.icon,
    required this.title,
    required this.note,
    required this.tint,
    required this.edge,
    required this.colour,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String note;
  final Color tint;
  final Color edge;
  final Color colour;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: tint,
      borderRadius: K.radius(K.rMd),
      child: InkWell(
        onTap: onTap,
        borderRadius: K.radius(K.rMd),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: K.radius(K.rMd),
            border: Border.all(color: edge),
          ),
          padding: const EdgeInsets.fromLTRB(K.s12, K.s12, K.s10, K.s12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: colour),
              const SizedBox(height: K.s8),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: K.fontFamily,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.2,
                  color: colour,
                ),
              ),
              const SizedBox(height: K.s2),
              Text(
                note,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: K.fontFamily,
                  fontSize: 11,
                  height: 1.35,
                  color: K.inkMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: K.surface,
      borderRadius: K.radius(K.rSm),
      child: InkWell(
        onTap: onTap,
        borderRadius: K.radius(K.rSm),
        child: Ink(
          decoration: BoxDecoration(borderRadius: K.radius(K.rSm), border: K.hairline),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 17, color: K.brand),
              const SizedBox(height: K.s6),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: K.fontFamily,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: K.inkSoft,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
