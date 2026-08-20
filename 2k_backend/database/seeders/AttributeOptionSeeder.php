<?php

namespace Database\Seeders;

use App\Models\Attribute;
use App\Models\AttributeValue;
use Illuminate\Database\Seeder;

/**
 * Turn the four existing attributes into pickable options, and add the ones
 * this catalogue actually needs.
 *
 * Values are drawn from what sellers have already typed into the 219 existing
 * attribute rows where possible, so the lists match the real catalogue rather
 * than an idealised one. Administrators can edit all of it afterwards.
 *
 * Idempotent: matched on name, so re-running never duplicates.
 */
class AttributeOptionSeeder extends Seeder
{
    public function run(): void
    {
        $definitions = [
            // name, input type, category (null = every category), options
            ['BRAND', 'text', null, []],
            ['COLOR', 'select', null, [
                'Black', 'White', 'Grey', 'Blue', 'Red', 'Green',
                'Yellow', 'Brown', 'Beige', 'Pink', 'Purple', 'Gold', 'Silver', 'Multicolour',
            ]],
            ['SIZE', 'select', null, ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']],
            ['RAM', 'select', null, ['2GB', '4GB', '6GB', '8GB', '12GB', '16GB', '32GB']],
            ['STORAGE', 'select', null, ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB']],
            ['MATERIAL', 'select', null, ['Cotton', 'Polyester', 'Leather', 'Denim', 'Wool', 'Silk', 'Linen', 'Synthetic']],
            ['SHOE SIZE', 'select', null, ['38', '39', '40', '41', '42', '43', '44', '45', '46']],
            ['CONDITION', 'select', null, ['Brand new', 'Pre-owned', 'Refurbished']],
            ['VOLUME', 'text', null, []],
            ['WARRANTY', 'select', null, ['No warranty', '1 month', '3 months', '6 months', '1 year', '2 years']],
        ];

        foreach ($definitions as [$name, $inputType, $categoryId, $options]) {
            $attribute = Attribute::firstOrCreate(
                ['name' => $name],
                ['category_id' => $categoryId],
            );

            // An attribute that has curated options must be a picker: the
            // column default is 'text', which is truthy, so a plain ?: would
            // leave pre-existing attributes as free text despite their list.
            $attribute->forceFill([
                'input_type' => $options ? $inputType : ($attribute->input_type ?: $inputType),
                'is_active'  => true,
            ])->save();

            foreach ($options as $index => $option) {
                AttributeValue::firstOrCreate(
                    ['attribute_id' => $attribute->id, 'value' => $option],
                    ['sort_order' => $index],
                );
            }
        }
    }
}
