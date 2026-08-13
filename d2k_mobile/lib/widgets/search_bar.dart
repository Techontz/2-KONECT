import 'dart:async';

import 'package:flutter/material.dart';

import '../core/l10n/app_strings.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';
import '../data/promo_data.dart';

/// The tappable search field on Home / Categories / Deals.
///
/// On Home the reference animates a rotating term after the static "Search"
/// prefix; [rotating] reproduces that.
class D2KSearchField extends StatefulWidget {
  const D2KSearchField({
    super.key,
    required this.onTap,
    this.rotating = false,
    this.hint,
    this.elevated = true,
  });

  final VoidCallback onTap;
  final bool rotating;
  final String? hint;
  final bool elevated;

  @override
  State<D2KSearchField> createState() => _D2KSearchFieldState();
}

class _D2KSearchFieldState extends State<D2KSearchField> {
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    if (widget.rotating) {
      _timer = Timer.periodic(const Duration(seconds: 3), (_) {
        if (!mounted) return;
        setState(() =>
            _index = (_index + 1) % PromoData.searchRotators.length);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: AppSizes.searchBarHeight,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: widget.elevated
              ? null
              : Border.all(color: AppColors.divider),
          boxShadow: widget.elevated ? AppShadows.card : null,
        ),
        child: Row(
          children: [
            const Icon(Icons.search, size: 22, color: AppColors.textPrimary),
            const SizedBox(width: 10),
            Expanded(
              child: widget.rotating
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('${strings.searchPrefix} ',
                            style: AppTypography.searchHint),
                        Flexible(
                          child: AnimatedSwitcher(
                            duration: const Duration(milliseconds: 320),
                            layoutBuilder: (current, previous) => Stack(
                              alignment: Alignment.centerLeft,
                              children: [...previous, ?current],
                            ),
                            transitionBuilder: (child, animation) =>
                                SlideTransition(
                              position: Tween<Offset>(
                                begin: const Offset(0, 0.6),
                                end: Offset.zero,
                              ).animate(animation),
                              child: FadeTransition(
                                  opacity: animation, child: child),
                            ),
                            child: Text(
                              PromoData.searchRotators[_index],
                              key: ValueKey(_index),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.searchHint,
                            ),
                          ),
                        ),
                      ],
                    )
                  : Text(
                      widget.hint ?? strings.whatAreYouLookingFor,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.searchHint,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The live search field on the search screen: leading back chevron, clear
/// button, autofocus.
class D2KSearchInput extends StatelessWidget {
  const D2KSearchInput({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.onSubmitted,
    required this.onChanged,
    this.onBack,
    this.hint,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onSubmitted;
  final ValueChanged<String> onChanged;
  final VoidCallback? onBack;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final strings = context.strings;
    return Container(
      height: AppSizes.searchBarHeight,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack ?? () => Navigator.of(context).maybePop(),
            icon: const Icon(Icons.chevron_left, size: 26),
            color: AppColors.textPrimary,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 42, minHeight: 42),
          ),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              autofocus: true,
              textInputAction: TextInputAction.search,
              onSubmitted: onSubmitted,
              onChanged: onChanged,
              style: AppTypography.searchHint
                  .copyWith(color: AppColors.textPrimary),
              cursorColor: AppColors.primary,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: hint ?? strings.whatAreYouLookingFor,
                hintStyle: AppTypography.searchHint,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) => value.text.isEmpty
                ? const SizedBox(width: 12)
                : IconButton(
                    onPressed: () {
                      controller.clear();
                      onChanged('');
                    },
                    icon: const Icon(Icons.close, size: 20),
                    color: AppColors.textSecondary,
                    constraints:
                        const BoxConstraints(minWidth: 42, minHeight: 42),
                  ),
          ),
        ],
      ),
    );
  }
}
