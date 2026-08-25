import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/brand.dart';
import '../../../core/theme/tokens.dart';
import '../../../models/catalog.dart';
import '../../../models/common.dart';
import '../../../providers/language.dart';
import '../../../services/catalog_service.dart';
import 'price_filter.dart';

/// Every filter, in one sheet.
///
/// It edits a *draft* and only hands it back when the customer says so, so a
/// half-set combination never fires four requests on the way to being useful.
/// The counts and the price ceiling come from the server's facets for the
/// current result set — nothing here is a figure written down in the app.
class FilterSheet extends ConsumerStatefulWidget {
  const FilterSheet({
    super.key,
    required this.query,
    required this.filters,
    required this.resultCount,
    this.lockedAvailability,
  });

  final ProductQuery query;
  final ListingFilters filters;
  final int resultCount;

  /// Set when the screen itself is "In Tanzania" or "From abroad", in which
  /// case the type control is not a choice the sheet may offer.
  final Availability? lockedAvailability;

  @override
  ConsumerState<FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<FilterSheet> {
  late ProductQuery _draft = widget.query;

  void _set(ProductQuery next) => setState(() => _draft = next.copyWith(page: 1));

  /// The two ways to buy, in the reader's language rather than the server's.
  String _availabilityLabel(WidgetRef ref, Availability value) => value.isImport
      ? ref.t('filters.fromAbroad')
      : ref.t('filters.inCountry', {'country': Brand.country});

  @override
  Widget build(BuildContext context) {
    final filters = widget.filters;
    final applied = _draft.appliedCount(scopedAvailability: widget.lockedAvailability);

    return DraggableScrollableSheet(
      initialChildSize: 0.86,
      minChildSize: 0.5,
      maxChildSize: 0.94,
      expand: false,
      builder: (context, scrollController) => Column(
        children: [
          _Grabber(title: ref.t('filters.title'), onClose: () => Navigator.pop(context)),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
              children: [
                if (widget.lockedAvailability == null && filters.availability.isNotEmpty) ...[
                  _Group(
                    title: ref.t('filters.whereIsIt'),
                    child: Wrap(
                      spacing: 7,
                      runSpacing: 7,
                      children: [
                        _Choice(
                          label: ref.t('filters.all'),
                          selected: _draft.availability == null,
                          onTap: () => _set(_draft.copyWith(availability: null)),
                        ),
                        for (final facet in filters.availability)
                          _Choice(
                            // The facet's own label is the server's English.
                            // The count is its, the words are ours — otherwise
                            // this sheet reads half in one language.
                            label: '${_availabilityLabel(ref, facet.value)}'
                                ' (${facet.count})',
                            selected: _draft.availability == facet.value,
                            tone: facet.value.isImport ? K.import : K.local,
                            onTap: () => _set(_draft.copyWith(availability: facet.value)),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: K.s24),
                ],

                if (filters.price.isUsable) ...[
                  PriceFilter(
                    min: filters.price.min,
                    max: filters.price.max,
                    value: _draft.maxPrice,
                    onChanged: (value) => _set(_draft.copyWith(maxPrice: value)),
                  ),
                  const SizedBox(height: K.s24),
                ],

                _Group(
                  title: ref.t('filters.deliveryTime'),
                  child: Wrap(
                    spacing: 7,
                    runSpacing: 7,
                    children: [
                      _Choice(
                        label: ref.t('filters.anyTime'),
                        selected: _draft.maxDays == null,
                        onTap: () => _set(_draft.copyWith(maxDays: null)),
                      ),
                      _Choice(
                        label: ref.t('filters.within3Days'),
                        selected: _draft.maxDays == 3,
                        onTap: () => _set(_draft.copyWith(maxDays: 3)),
                      ),
                      _Choice(
                        label: ref.t('filters.withinWeek'),
                        selected: _draft.maxDays == 7,
                        onTap: () => _set(_draft.copyWith(maxDays: 7)),
                      ),
                      _Choice(
                        label: ref.t('filters.withinTwoWeeks'),
                        selected: _draft.maxDays == 14,
                        onTap: () => _set(_draft.copyWith(maxDays: 14)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: K.s24),

                if (filters.origins.length > 1) ...[
                  _Group(
                    title: ref.t('filters.shipsFrom'),
                    child: Wrap(
                      spacing: 7,
                      runSpacing: 7,
                      children: [
                        _Choice(
                          label: ref.t('filters.anywhere'),
                          selected: _draft.sourceCountry == null,
                          onTap: () => _set(_draft.copyWith(sourceCountry: null)),
                        ),
                        for (final origin in filters.origins)
                          _Choice(
                            label: '${origin.country.flag} ${origin.country.name} (${origin.count})',
                            selected: _draft.sourceCountry == origin.country.code,
                            onTap: () =>
                                _set(_draft.copyWith(sourceCountry: origin.country.code)),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: K.s24),
                ],

                if (filters.subcategories.isNotEmpty) ...[
                  _Group(
                    title: ref.t('nav.categories'),
                    child: Wrap(
                      spacing: 7,
                      runSpacing: 7,
                      children: [
                        _Choice(
                          label: ref.t('filters.all'),
                          selected: _draft.subcategoryId == null,
                          onTap: () => _set(_draft.copyWith(subcategoryId: null)),
                        ),
                        for (final sub in filters.subcategories.take(24))
                          _Choice(
                            label: '${sub.name} (${sub.count})',
                            selected: _draft.subcategoryId == sub.id,
                            onTap: () => _set(_draft.copyWith(subcategoryId: sub.id)),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: K.s24),
                ],

                _Group(
                  title: ref.t('filters.trust'),
                  child: Column(
                    children: [
                      _Switch(
                        label: ref.t('filters.inStockNow'),
                        value: _draft.inStock == true,
                        onChanged: (on) => _set(_draft.copyWith(inStock: on ? true : null)),
                      ),
                      _Switch(
                        label: ref.t('filters.onSale'),
                        value: _draft.onSale == true,
                        onChanged: (on) => _set(_draft.copyWith(onSale: on ? true : null)),
                      ),
                      _Switch(
                        label: ref.t('filters.verifiedOnly'),
                        value: _draft.verified == true,
                        onChanged: (on) => _set(_draft.copyWith(verified: on ? true : null)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _Footer(
            applied: applied,
            resultCount: widget.resultCount,
            onClear: () => _set(ProductQuery(
              categoryId: widget.query.categoryId,
              q: widget.query.q,
              vendorId: widget.query.vendorId,
              availability: widget.lockedAvailability,
              sort: widget.query.sort,
              perPage: widget.query.perPage,
            )),
            onApply: () => Navigator.pop(context, _draft),
          ),
        ],
      ),
    );
  }
}

class _Grabber extends StatelessWidget {
  const _Grabber({required this.title, required this.onClose});

  final String title;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 10, 8, 10),
      child: Row(
        children: [
          Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
          IconButton(onPressed: onClose, icon: const Icon(Icons.close_rounded)),
        ],
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: K.ink),
        ),
        const SizedBox(height: K.s10),
        child,
      ],
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({
    required this.label,
    required this.selected,
    required this.onTap,
    this.tone,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final accent = tone ?? K.brand;

    return Material(
      color: selected ? accent : K.surface,
      borderRadius: K.radius(K.rPill),
      child: InkWell(
        onTap: onTap,
        borderRadius: K.radius(K.rPill),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: K.radius(K.rPill),
            border: Border.all(color: selected ? accent : K.lineStrong),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: selected ? Colors.white : K.inkSoft,
            ),
          ),
        ),
      ),
    );
  }
}

class _Switch extends StatelessWidget {
  const _Switch({required this.label, required this.value, required this.onChanged});

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile.adaptive(
      value: value,
      onChanged: onChanged,
      contentPadding: EdgeInsets.zero,
      dense: true,
      activeThumbColor: K.brand,
      title: Text(
        label,
        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: K.inkSoft),
      ),
    );
  }
}

class _Footer extends ConsumerWidget {
  const _Footer({
    required this.applied,
    required this.resultCount,
    required this.onClear,
    required this.onApply,
  });

  final int applied;
  final int resultCount;
  final VoidCallback onClear;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: const BoxDecoration(
        color: K.surface,
        border: Border(top: BorderSide(color: K.line)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 12),
          child: Row(
            children: [
              if (applied > 0) ...[
                Expanded(
                  child: OutlinedButton(
                    onPressed: onClear,
                    child: Text(ref.t('filters.clearAllCount', {'count': applied})),
                  ),
                ),
                const SizedBox(width: K.s10),
              ],
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: onApply,
                  child: Text(
                    resultCount == 1
                        ? ref.t('filters.applyOne')
                        : ref.t('filters.apply', {'count': resultCount}),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
