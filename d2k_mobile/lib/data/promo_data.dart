
import '../domain/models/location.dart';

/// Editorial content for the home / deals feeds. In production this is what an
/// API would return; the widget layer never hardcodes copy or colours.
class PromoData {
  const PromoData._();






  /// The 2-row scrolling tile grid under the hero banner.


  /// Editorial strip used by the "Back to School"-style themed section.

  static const List<String> trendingSearches = [
    'iPhone',
    'Samsung Galaxy',
    'Perfume',
    'Air fryer',
    'Sneakers',
    'Smart watch',
    'Kitenge dress',
    'Bluetooth speaker',
    'Rice cooker',
    'Sunglasses',
  ];

  /// Rotating search placeholders — the reference cycles these in the field.
  static const List<String> searchRotators = [
    'iPhone',
    'Fresh Fruits',
    'TVs',
    'Air Fryer',
    'Sunscreen',
    'Shoes',
    'Coffee & Tea Sets',
    'Home Decor',
    'Perfume',
    'Kitchenware',
  ];

  static const List<ShippingCountry> countries = [
    ShippingCountry(
      code: 'TZ',
      name: 'Tanzania',
      flag: '🇹🇿',
      dialCode: '+255',
      isPrimary: true,
      cities: [
        'Dar es Salaam',
        'Dodoma',
        'Arusha',
        'Mwanza',
        'Zanzibar City',
        'Mbeya',
        'Morogoro',
        'Tanga',
      ],
    ),
    ShippingCountry(
      code: 'KE',
      name: 'Kenya',
      flag: '🇰🇪',
      dialCode: '+254',
      cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru'],
    ),
    ShippingCountry(
      code: 'UG',
      name: 'Uganda',
      flag: '🇺🇬',
      dialCode: '+256',
      cities: ['Kampala', 'Entebbe', 'Gulu', 'Mbarara'],
    ),
    ShippingCountry(
      code: 'RW',
      name: 'Rwanda',
      flag: '🇷🇼',
      dialCode: '+250',
      cities: ['Kigali', 'Butare', 'Gisenyi'],
    ),
    ShippingCountry(
      code: 'ZM',
      name: 'Zambia',
      flag: '🇿🇲',
      dialCode: '+260',
      cities: ['Lusaka', 'Ndola', 'Kitwe'],
    ),
    ShippingCountry(
      code: 'MW',
      name: 'Malawi',
      flag: '🇲🇼',
      dialCode: '+265',
      cities: ['Lilongwe', 'Blantyre', 'Mzuzu'],
    ),
  ];

  /// Areas offered by the location picker for the launch market.
  static const List<Map<String, String>> tanzaniaAreas = [
    {'area': 'Kariakoo Market', 'city': 'Dar es Salaam'},
    {'area': 'Msimbazi Street', 'city': 'Dar es Salaam'},
    {'area': 'Mlimani City', 'city': 'Dar es Salaam'},
    {'area': 'Masaki', 'city': 'Dar es Salaam'},
    {'area': 'Mikocheni', 'city': 'Dar es Salaam'},
    {'area': 'Ubungo', 'city': 'Dar es Salaam'},
    {'area': 'Njiro', 'city': 'Arusha'},
    {'area': 'Nyerere Road', 'city': 'Dodoma'},
    {'area': 'Nyamagana', 'city': 'Mwanza'},
    {'area': 'Stone Town', 'city': 'Zanzibar City'},
  ];
}
