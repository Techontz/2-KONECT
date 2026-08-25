import 'dart:convert';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:xml/xml.dart';

import '../core/theme/tokens.dart';

/// A banner plate, whatever format the administrator published it in.
///
/// ---- why this file exists ----
///
/// Every banner on production is **`image/svg+xml`**, authored at
/// `viewBox="0 0 1200 400"`. Flutter's own image codecs decode PNG, JPEG,
/// WebP, GIF and BMP and nothing else, so a `CachedNetworkImage` pointed at
/// one returns its error widget — which is why the hero rendered as an empty
/// plate on the phone while the website, whose `<img>` renders SVG natively,
/// showed it perfectly.
///
/// So SVG goes through `flutter_svg` and raster through
/// `cached_network_image`. Both are disk-cached; the SVG path fetches its
/// bytes through the shared [DefaultCacheManager] rather than
/// `SvgPicture.network`, which keeps no disk cache of its own and would
/// re-download every banner on every return to the home screen.
class BannerImage extends StatelessWidget {
  const BannerImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.semanticLabel,
    this.stripCopy = false,
  });

  final String? url;
  final BoxFit fit;
  final String? semanticLabel;

  /// Drop the artwork's own copy layer, because the caller is drawing the
  /// title, subtitle and call-to-action natively from the API's own fields.
  /// See [withoutCopyLayer] for why that is worth doing.
  final bool stripCopy;

  /// True when this URL should be decoded as vector rather than raster.
  ///
  /// The path is the only thing available before the request is made, and the
  /// backend writes a real extension for every stored file. A URL carrying a
  /// query string still resolves correctly, because the path is taken from the
  /// parsed [Uri] rather than from the raw string.
  static bool isVector(String url) {
    final path = (Uri.tryParse(url)?.path ?? url).toLowerCase();
    return path.endsWith('.svg') || path.endsWith('.svgz');
  }

  /// Removes the campaign copy from vector artwork, leaving the plate.
  ///
  /// ---- why ----
  ///
  /// These banners draw their eyebrow, headline, subtitle and button *into*
  /// the artwork. `flutter_svg` renders most of it but drops some of it: on
  /// the live "Big deals" campaign the 900-weight headline and the white
  /// button plate do not paint, so the banner reads as a subtitle floating in
  /// empty space. That was verified on device against production, and it is
  /// not a font-resolution problem — pointing the artwork at a bundled family
  /// changes nothing.
  ///
  /// The API already carries `title`, `subtitle` and `cta_label` as structured
  /// fields, which is exactly the contract that lets a client present them
  /// properly. So the copy is lifted out of the artwork and drawn natively, in
  /// Plus Jakarta Sans — which is not merely a workaround but closer to the
  /// intended design than the website manages, since the artwork asks for
  /// `system-ui` and gets whatever the reader's machine happens to have.
  ///
  /// The rule is structural, not a pattern match on this month's artwork: any
  /// element that *contains* text is copy. Nothing is added or invented — every
  /// word the customer reads still comes from the API.
  ///
  /// Returns the source unchanged if it cannot be parsed, so a malformed
  /// banner degrades to "render whatever you can" rather than to nothing.
  static String withoutCopyLayer(String svg) {
    try {
      final document = XmlDocument.parse(svg);
      final root = document.rootElement;

      bool carriesText(XmlNode node) =>
          node is XmlElement &&
          (node.localName == 'text' ||
              node.findAllElements('text').isNotEmpty);

      // Only the artwork's own children are considered. `<defs>` is left alone
      // — gradients and patterns are referenced by the plate, not drawn.
      final copy = root.children.where(carriesText).toList();
      for (final node in copy) {
        node.remove();
      }
      return document.toXmlString();
    } on Object {
      return svg;
    }
  }

  @override
  Widget build(BuildContext context) {
    final source = url;
    if (source == null || source.isEmpty) return const _BannerFallback();

    if (isVector(source)) {
      return _CachedSvg(
        url: source,
        fit: fit,
        semanticLabel: semanticLabel,
        stripCopy: stripCopy,
      );
    }

    // Raster artwork is rendered exactly as the website renders it: whole. A
    // photograph or a flattened campaign has no copy layer to lift out, and
    // its wording is presumed baked in — so nothing is drawn over it.
    return CachedNetworkImage(
      imageUrl: source,
      fit: fit,
      fadeInDuration: K.fast,
      placeholder: (_, _) => const ColoredBox(color: K.brandDeep),
      errorWidget: (_, _, _) => const _BannerFallback(),
    );
  }
}

/// An SVG fetched once, kept on disk, and drawn from memory thereafter.
class _CachedSvg extends StatefulWidget {
  const _CachedSvg({
    required this.url,
    required this.fit,
    required this.stripCopy,
    this.semanticLabel,
  });

  final String url;
  final BoxFit fit;
  final bool stripCopy;
  final String? semanticLabel;

  @override
  State<_CachedSvg> createState() => _CachedSvgState();
}

class _CachedSvgState extends State<_CachedSvg> {
  late Future<Uint8List> _bytes = _load();

  Future<Uint8List> _load() async {
    final file = await DefaultCacheManager().getSingleFile(widget.url);
    if (!widget.stripCopy) return file.readAsBytes();

    final source = await file.readAsString();
    return Uint8List.fromList(
      utf8.encode(BannerImage.withoutCopyLayer(source)),
    );
  }

  @override
  void didUpdateWidget(_CachedSvg old) {
    super.didUpdateWidget(old);
    if (old.url != widget.url || old.stripCopy != widget.stripCopy) {
      _bytes = _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Uint8List>(
      future: _bytes,
      builder: (context, snapshot) {
        if (snapshot.hasError) return const _BannerFallback();
        final data = snapshot.data;
        if (data == null) {
          // The brand ground rather than a spinner: the artwork is a dark navy
          // plate, so this reads as the banner arriving rather than as a hole
          // where one should be.
          return const ColoredBox(color: K.brandDeep);
        }
        return SvgPicture.memory(
          data,
          fit: widget.fit,
          semanticsLabel: widget.semanticLabel,
          placeholderBuilder: (_) => const ColoredBox(color: K.brandDeep),
        );
      },
    );
  }
}

/// What a missing or undecodable banner looks like.
///
/// The brand ground with a quiet mark — never a broken-image glyph, and never
/// zero height, because a campaign slot that collapses shifts everything
/// beneath it the moment one image fails.
class _BannerFallback extends StatelessWidget {
  const _BannerFallback();

  @override
  Widget build(BuildContext context) => const ColoredBox(
        color: K.brandDeep,
        child: Center(
          child: Icon(Icons.image_outlined, size: 26, color: K.brand400),
        ),
      );
}
