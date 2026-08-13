import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_metrics.dart';
import '../core/theme/app_typography.dart';
import '../domain/models/commerce.dart';
import '../domain/models/product.dart';
import '../state/cart_controller.dart';

/// The white "+" plate on a product image. Once the product is in the cart it
/// morphs into a compact −/qty/+ stepper, matching the reference behaviour.
class AddToCartButton extends StatelessWidget {
  const AddToCartButton({super.key, required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartController>();
    final quantity = cart.quantityOf(product);

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 180),
      transitionBuilder: (child, animation) => ScaleTransition(
        scale: animation,
        child: FadeTransition(opacity: animation, child: child),
      ),
      child: quantity == 0
          ? _AddPlate(
              key: const ValueKey('add'),
              onTap: () => cart.add(product),
              enabled: product.inStock,
            )
          : _Stepper(
              key: const ValueKey('stepper'),
              quantity: quantity,
              onIncrement: () => cart.add(product),
              onDecrement: () {
                final item = cart.items.firstWhere(
                  (i) => i.product.id == product.id,
                  orElse: () => CartItem(product: product, quantity: 0),
                );
                if (item.quantity > 0) cart.decrement(item);
              },
            ),
    );
  }
}

class _AddPlate extends StatelessWidget {
  const _AddPlate({super.key, required this.onTap, required this.enabled});

  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        boxShadow: AppShadows.card,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: enabled ? onTap : null,
          child: SizedBox(
            width: AppSizes.addButton,
            height: AppSizes.addButton,
            child: Icon(
              Icons.add,
              size: 20,
              color: enabled ? AppColors.textPrimary : AppColors.textTertiary,
            ),
          ),
        ),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({
    super.key,
    required this.quantity,
    required this.onIncrement,
    required this.onDecrement,
  });

  final int quantity;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: AppSizes.addButton,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepIcon(
            icon: quantity == 1 ? Icons.delete_outline : Icons.remove,
            onTap: onDecrement,
          ),
          SizedBox(
            width: 22,
            child: Text(
              '$quantity',
              textAlign: TextAlign.center,
              style: AppTypography.buttonSmall,
            ),
          ),
          _StepIcon(icon: Icons.add, onTap: onIncrement),
        ],
      ),
    );
  }
}

class _StepIcon extends StatelessWidget {
  const _StepIcon({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.sm),
      child: SizedBox(
        width: 30,
        height: AppSizes.addButton,
        child: Icon(icon, size: 17, color: AppColors.primary),
      ),
    );
  }
}

/// Full-width quantity stepper used in the cart rows.
class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.onIncrement,
    required this.onDecrement,
  });

  final int quantity;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: AppColors.divider),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepIcon(
            icon: quantity == 1 ? Icons.delete_outline : Icons.remove,
            onTap: onDecrement,
          ),
          SizedBox(
            width: 30,
            child: Text(
              '$quantity',
              textAlign: TextAlign.center,
              style: AppTypography.bodyStrong,
            ),
          ),
          _StepIcon(icon: Icons.add, onTap: onIncrement),
        ],
      ),
    );
  }
}
