import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/tokens.dart';
import '../../providers/catalog.dart';
import '../../providers/language.dart';
import '../../widgets/states.dart';
import '../products/listing_screen.dart';

/// Search.
///
/// The whole screen, not a strip in the header: suggestions, recent terms and
/// results all need room, and on a phone the keyboard already takes half of
/// what there is. Typing is debounced so a fast typist issues one request
/// rather than nine.
///
/// When nothing matches, the way out is 2KONECT's own answer — ask us to
/// source it — rather than a dead end.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.initialTerm});

  final String? initialTerm;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

/// The field is its own plate inside the navy band; the outline the rest of
/// the app uses would read as a box drawn on a box.
final _plate = OutlineInputBorder(
  borderRadius: K.radius(K.rSm),
  borderSide: BorderSide.none,
);

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialTerm ?? '');
  final _focus = FocusNode();

  /// What is being typed — drives suggestions.
  String _typed = '';

  /// What was actually submitted — drives results. They differ on purpose: the
  /// grid must not thrash on every keystroke.
  String? _submitted;

  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _typed = widget.initialTerm ?? '';
    _submitted = widget.initialTerm;
    if (widget.initialTerm == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () {
      if (mounted) setState(() => _typed = value);
    });
  }

  void _submit(String term) {
    final trimmed = term.trim();
    if (trimmed.isEmpty) return;
    ref.read(recentSearchesProvider.notifier).record(trimmed);
    _controller.text = trimmed;
    _focus.unfocus();
    setState(() {
      _typed = trimmed;
      _submitted = trimmed;
    });
  }

  @override
  Widget build(BuildContext context) {
    final showSuggestions = _focus.hasFocus || _submitted == null;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: K.s12),
          child: SizedBox(
            height: 44,
            child: TextField(
              controller: _controller,
              focusNode: _focus,
              autocorrect: false,
              textInputAction: TextInputAction.search,
              onChanged: _onChanged,
              onSubmitted: _submit,
              onTap: () => setState(() {}),
              style: const TextStyle(
                fontFamily: K.fontFamily,
                fontSize: 14.5,
                fontWeight: FontWeight.w500,
                color: K.ink,
              ),
              decoration: InputDecoration(
                hintText: ref.t('header.searchAllPlaceholder'),
                // No border at all while it sits in the navy band: the white
                // plate is already the field, and a hairline on top of it just
                // draws a second edge.
                filled: true,
                fillColor: Colors.white,
                border: _plate,
                enabledBorder: _plate,
                focusedBorder: _plate,
                contentPadding: EdgeInsets.zero,
                prefixIcon: const Icon(Icons.search_rounded, size: 19, color: K.inkMuted),
                prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                suffixIcon: _controller.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: ref.t('header.clearSearch'),
                        icon: const Icon(Icons.cancel_rounded, size: 18, color: K.inkFaint),
                        onPressed: () {
                          _controller.clear();
                          setState(() {
                            _typed = '';
                            _submitted = null;
                          });
                          _focus.requestFocus();
                        },
                      ),
              ),
            ),
          ),
        ),
      ),
      body: showSuggestions && _typed.trim().length < 2
          ? _Recent(onPick: _submit)
          : showSuggestions
              ? _Suggestions(term: _typed, onPick: _submit)
              : ListingScreen(
                  key: ValueKey(_submitted),
                  term: _submitted,
                  title: _submitted,
                  showAppBar: false,
                ),
    );
  }
}

class _Recent extends ConsumerWidget {
  const _Recent({required this.onPick});

  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recent = ref.watch(recentSearchesProvider);

    if (recent.isEmpty) {
      return EmptyState(
        icon: Icons.search_rounded,
        title: ref.t('search.placeholder'),
        message: ref.t('header.searchAllPlaceholder'),
        actionLabel: ref.t('nav.requestProduct'),
        onAction: () => context.push('/request'),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                ref.t('app.recentSearches'),
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
              ),
            ),
            TextButton(
              onPressed: () => ref.read(recentSearchesProvider.notifier).clear(),
              child: Text(ref.t('common.clear')),
            ),
          ],
        ),
        const SizedBox(height: K.s4),
        for (final term in recent)
          InkWell(
            onTap: () => onPick(term),
            borderRadius: K.radius(K.rSm),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: K.s12, horizontal: K.s2),
              child: Row(
                children: [
                  const Icon(Icons.history_rounded, size: 17, color: K.inkFaint),
                  const SizedBox(width: K.s12),
                  Expanded(
                    child: Text(
                      term,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: K.fontFamily,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const Icon(Icons.north_west_rounded, size: 15, color: K.lineStrong),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _Suggestions extends ConsumerWidget {
  const _Suggestions({required this.term, required this.onPick});

  final String term;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suggestions = ref.watch(suggestionsProvider(term));

    return suggestions.when(
      loading: () => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 6,
        itemBuilder: (_, _) => const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Skeleton(height: 15),
        ),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (data) {
        if (data.isEmpty) {
          return EmptyState(
            icon: Icons.search_off_rounded,
            title: ref.t('header.noMatch', {'term': term}),
            message: ref.t('header.noMatchHint'),
            actionLabel: ref.t('nav.requestProduct'),
            onAction: () => context.push('/request?q=${Uri.encodeComponent(term)}'),
          );
        }

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            if (data.categories.isNotEmpty) ...[
              _Head(label: ref.t('header.categories')),
              for (final category in data.categories)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: const Icon(Icons.category_outlined, size: 18, color: K.inkMuted),
                  title: Text(category.name, style: const TextStyle(fontSize: 13.5)),
                  onTap: () => context.push(
                    '/category/${category.id}?name=${Uri.encodeComponent(category.name)}',
                  ),
                ),
              const SizedBox(height: K.s10),
            ],
            if (data.products.isNotEmpty) ...[
              _Head(label: ref.t('header.products')),
              for (final product in data.products)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  leading: const Icon(Icons.shopping_bag_outlined, size: 18, color: K.inkMuted),
                  title: Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13.5),
                  ),
                  onTap: () => context.push('/product/${product.id}'),
                ),
            ],
            const SizedBox(height: K.s12),
            OutlinedButton(
              onPressed: () => onPick(term),
              child: Text(ref.t('search.resultsFor', {'term': term})),
            ),
          ],
        );
      },
    );
  }
}

class _Head extends StatelessWidget {
  const _Head({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 2),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.4,
            color: K.inkFaint,
          ),
        ),
      );
}
