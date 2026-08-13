import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_metrics.dart';
import '../../core/theme/app_typography.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../../state/currency_controller.dart';
import '../../widgets/states.dart';

/// The floating blue "Sort ⇅ | Filter ▽" pill from the reference listings.
class SortFilterPill extends StatelessWidget {
  const SortFilterPill({
    super.key,
    required this.onSort,
    required this.onFilter,
    this.activeFilters = 0,
    this.onShare,
  });

  final VoidCallback onSort;
  final VoidCallback onFilter;
  final int activeFilters;
  final VoidCallback? onShare;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Material(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          clipBehavior: Clip.antiAlias,
          elevation: 6,
          shadowColor: const Color(0x553F63DD),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              InkWell(
                onTap: onSort,
                child: Padding(
                  padding:
                      const EdgeInsets.fromLTRB(20, 12, 12, 12),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        strings.sort,
                        style: AppTypography.button.copyWith(fontSize: 15),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.swap_vert, size: 18, color: Colors.white),
                    ],
                  ),
                ),
              ),
              Container(width: 1, height: 22, color: Colors.white24),
              InkWell(
                onTap: onFilter,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 20, 12),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        activeFilters > 0
                            ? '${strings.filter} ($activeFilters)'
                            : strings.filter,
                        style: AppTypography.button.copyWith(fontSize: 15),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.filter_alt_outlined,
                          size: 18, color: Colors.white),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        if (onShare != null) ...[
          const SizedBox(width: 10),
          Material(
            color: AppColors.surface,
            shape: const CircleBorder(
              side: BorderSide(color: AppColors.primary, width: 1.4),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onShare,
              child: const SizedBox(
                width: 46,
                height: 46,
                child: Icon(Icons.ios_share,
                    size: 20, color: AppColors.primary),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

Future<SortOption?> showSortSheet(BuildContext context, SortOption current) {
  return showModalBottomSheet<SortOption>(
    context: context,
    builder: (sheetContext) => SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SheetGrip(),
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.gutter, 14, AppSpacing.gutter, 6),
            child: Text(context.strings.sort,
                style: AppTypography.sectionTitle),
          ),
          for (final option in SortOption.values)
            RadioListTile<SortOption>(
              value: option,
              // ignore: deprecated_member_use
              groupValue: current,
              // ignore: deprecated_member_use
              onChanged: (value) => Navigator.of(sheetContext).pop(value),
              activeColor: AppColors.primary,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.gutter),
              title: Text(option.label, style: AppTypography.body),
            ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
}

Future<ProductFilter?> showFilterSheet(
  BuildContext context, {
  required ProductFilter filter,
  required List<String> brands,
}) {
  return showModalBottomSheet<ProductFilter>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) =>
        _FilterSheet(initial: filter, brands: brands),
  );
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.initial, required this.brands});

  final ProductFilter initial;
  final List<String> brands;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late ProductFilter _draft = widget.initial;
  late RangeValues _range = RangeValues(
    widget.initial.minPriceBase ?? 0,
    widget.initial.maxPriceBase ?? _maxPrice,
  );

  static const double _maxPrice = 5000000;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    final currency = context.watch<CurrencyController>();

    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.78,
      child: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SheetGrip(),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter, 14, AppSpacing.gutter, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(strings.filter,
                        style: AppTypography.sectionTitle),
                  ),
                  TextButton(
                    onPressed: () => setState(() {
                      _draft = ProductFilter(
                        categoryId: widget.initial.categoryId,
                        subcategory: widget.initial.subcategory,
                      );
                      _range = const RangeValues(0, _maxPrice);
                    }),
                    child: Text(strings.clearAll,
                        style: AppTypography.sectionAction),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.gutter, vertical: 8),
                children: [
                  _FilterLabel('Price range'),
                  RangeSlider(
                    values: _range,
                    min: 0,
                    max: _maxPrice,
                    divisions: 50,
                    activeColor: AppColors.primary,
                    labels: RangeLabels(
                      currency.formatValue(_range.start, compact: true),
                      currency.formatValue(_range.end, compact: true),
                    ),
                    onChanged: (value) => setState(() => _range = value),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(currency.formatValue(_range.start),
                          style: AppTypography.metaMuted),
                      Text(currency.formatValue(_range.end),
                          style: AppTypography.metaMuted),
                    ],
                  ),
                  const SizedBox(height: 18),
                  _FilterLabel('Customer rating'),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final rating in [4.5, 4.0, 3.5])
                        ChoiceChip(
                          label: Text('$rating & up'),
                          selected: _draft.minRating == rating,
                          selectedColor: AppColors.primarySoft,
                          labelStyle: AppTypography.buttonSmall,
                          onSelected: (selected) => setState(() {
                            _draft = selected
                                ? _draft.copyWith(minRating: rating)
                                : _draft.copyWith(clearRating: true);
                          }),
                        ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  _FilterLabel('Delivery & offers'),
                  SwitchListTile(
                    value: _draft.expressOnly,
                    activeThumbColor: AppColors.primary,
                    contentPadding: EdgeInsets.zero,
                    title: Text('D2K express only', style: AppTypography.body),
                    onChanged: (value) =>
                        setState(() => _draft = _draft.copyWith(expressOnly: value)),
                  ),
                  SwitchListTile(
                    value: _draft.dealsOnly,
                    activeThumbColor: AppColors.primary,
                    contentPadding: EdgeInsets.zero,
                    title:
                        Text('Discounted items only', style: AppTypography.body),
                    onChanged: (value) =>
                        setState(() => _draft = _draft.copyWith(dealsOnly: value)),
                  ),
                  const SizedBox(height: 12),
                  _FilterLabel('Brand'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      for (final brand in widget.brands)
                        FilterChip(
                          label: Text(brand),
                          selected: _draft.brands.contains(brand),
                          selectedColor: AppColors.primarySoft,
                          labelStyle: AppTypography.buttonSmall,
                          onSelected: (selected) => setState(() {
                            final next = Set<String>.from(_draft.brands);
                            selected ? next.add(brand) : next.remove(brand);
                            _draft = _draft.copyWith(brands: next);
                          }),
                        ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter, 8, AppSpacing.gutter, 12),
              child: PrimaryButton(
                label: strings.done,
                expand: true,
                color: AppColors.primary,
                onPressed: () => Navigator.of(context).pop(
                  _draft.copyWith(
                    minPriceBase: _range.start == 0 ? null : _range.start,
                    maxPriceBase:
                        _range.end == _maxPrice ? null : _range.end,
                    clearPrice: _range.start == 0 && _range.end == _maxPrice,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterLabel extends StatelessWidget {
  const _FilterLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(label, style: AppTypography.sectionTitleSmall),
      );
}

class _SheetGrip extends StatelessWidget {
  const _SheetGrip();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Center(
          child: Container(
            width: 42,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.divider,
              borderRadius: BorderRadius.circular(AppRadius.pill),
            ),
          ),
        ),
      );
}
