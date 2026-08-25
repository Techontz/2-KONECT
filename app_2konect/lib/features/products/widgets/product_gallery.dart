import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import '../../../widgets/primitives.dart';

/// The product's photographs.
///
/// Swipeable, with dots rather than thumbnails — a strip of thumbnails under a
/// square photo costs a phone more vertical space than it is worth, and the
/// dots already say how many there are.
class ProductGallery extends StatefulWidget {
  const ProductGallery({super.key, required this.images});

  final List<String> images;

  @override
  State<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends State<ProductGallery> {
  final _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.images.isEmpty) {
      return const ColoredBox(
        color: Colors.white,
        child: Center(child: Icon(Icons.shopping_bag_outlined, size: 46, color: K.brand300)),
      );
    }

    return ColoredBox(
      color: Colors.white,
      child: Stack(
        children: [
          Positioned.fill(
            child: PageView.builder(
              controller: _controller,
              itemCount: widget.images.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, index) => GestureDetector(
                onTap: () => _openFullscreen(index),
                child: ProductImage(
                  url: widget.images[index],
                  padding: const EdgeInsets.fromLTRB(24, 60, 24, 34),
                  decodeWidth: 900,
                ),
              ),
            ),
          ),
          if (widget.images.length > 1)
            Positioned(
              bottom: 12,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < widget.images.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: i == _index ? 16 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: i == _index ? K.brand : K.brand200,
                        borderRadius: K.radius(K.rPill),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  void _openFullscreen(int startAt) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => _Fullscreen(images: widget.images, initialIndex: startAt),
      ),
    );
  }
}

/// The photograph on its own, pinchable — the one place a product image is
/// worth the whole screen.
class _Fullscreen extends StatelessWidget {
  const _Fullscreen({required this.images, required this.initialIndex});

  final List<String> images;
  final int initialIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: PageView.builder(
        controller: PageController(initialPage: initialIndex),
        itemCount: images.length,
        itemBuilder: (context, index) => InteractiveViewer(
          minScale: 1,
          maxScale: 4,
          child: Center(child: ProductImage(url: images[index], decodeWidth: 1400)),
        ),
      ),
    );
  }
}
