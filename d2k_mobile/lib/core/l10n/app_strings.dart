import 'package:flutter/widgets.dart';

/// Supported interface languages. English is the launch default; Swahili is
/// wired end-to-end so translations can be filled in without touching widgets.
enum AppLanguage {
  // Swahili first and default: D2K's shoppers are in Tanzania.
  swahili('sw', 'Swahili', 'Kiswahili'),
  english('en', 'English', 'English'),
  french('fr', 'French', 'Français'),
  chinese('zh', 'Chinese', '中文');

  const AppLanguage(this.code, this.englishName, this.nativeName);

  final String code;
  final String englishName;
  final String nativeName;

  Locale get locale => Locale(code);

  static AppLanguage fromCode(String? code) => AppLanguage.values.firstWhere(
        (l) => l.code == code,
        orElse: () => AppLanguage.swahili,
      );
}

/// Centralised, localisation-ready string table.
///
/// Widgets never hardcode user-facing copy; they read `AppStrings.of(context)`
/// (or `context.strings`) so a language switch re-renders the whole tree.
class AppStrings {
  const AppStrings(this.language);

  final AppLanguage language;

  static AppStrings of(BuildContext context) =>
      StringsScope.of(context).strings;

  String _t(String key) =>
      (_tables[language.code]?[key]) ?? _tables['en']![key] ?? key;

  // --------------------------------------------------------------- generic
  String get appName => _t('appName');
  String get brandShort => _t('brandShort');
  String get continueLabel => _t('continue');
  String get skip => _t('skip');
  String get cancel => _t('cancel');
  String get done => _t('done');
  String get save => _t('save');
  String get retry => _t('retry');
  String get viewAll => _t('viewAll');
  String get viewAllCaps => _t('viewAllCaps');
  String get allDeals => _t('allDeals');
  String get seeMore => _t('seeMore');
  String get backToTop => _t('backToTop');
  String get refresh => _t('refresh');
  String get tryAgain => _t('tryAgain');

  // ------------------------------------------------------- network states
  String get nothingHereYet => _t('nothingHereYet');
  String get storefrontEmptyHint => _t('storefrontEmptyHint');
  String get couldNotLoad => _t('couldNotLoad');
  String get productsLabel => _t('productsLabel');
  String get noProductsFound => _t('noProductsFound');
  String get noResultsHint => _t('noResultsHint');

  // -------------------------------------------------------- product detail
  String get aboutThisItem => _t('aboutThisItem');
  String get specifications => _t('specifications');
  String get noDescription => _t('noDescription');
  String get soldBy => _t('soldBy');
  String get verifiedSeller => _t('verifiedSeller');
  String get contactSeller => _t('contactSeller');
  String get chatWithSeller => _t('chatWithSeller');
  String get callSeller => _t('callSeller');
  String get whatsapp => _t('whatsapp');
  String get visitStore => _t('visitStore');
  String get phoneUnavailable => _t('phoneUnavailable');
  String get outOfStock => _t('outOfStock');
  String get inStock => _t('inStock');

  // ------------------------------------------------------------------ chat
  String get messages => _t('messages');
  String get noMessagesYet => _t('noMessagesYet');
  String get startConversation => _t('startConversation');
  String get typeAMessage => _t('typeAMessage');
  String get signInToChat => _t('signInToChat');

  // ------------------------------------------------------------- commerce
  String get addresses => _t('addresses');
  String get noAddresses => _t('noAddresses');
  String get addAddress => _t('addAddress');
  String get deliverHere => _t('deliverHere');
  String get cashOnDelivery => _t('cashOnDelivery');
  String get comingSoon => _t('comingSoon');
  String get placeOrder => _t('placeOrder');
  String get orderPlaced => _t('orderPlaced');
  String get myOrders => _t('myOrders');
  String get noOrders => _t('noOrders');
  String get signInToContinue => _t('signInToContinue');

  // ---------------------------------------------------------------- onboard
  String get selectYourCountry => _t('selectYourCountry');
  String get selectYourCity => _t('selectYourCity');
  String get deliverTo => _t('deliverTo');
  String get searchYourLocation => _t('searchYourLocation');
  String get searchBuildingArea => _t('searchBuildingArea');
  String get zoomIn => _t('zoomIn');
  String get zoomInHint => _t('zoomInHint');
  String get confirmLocation => _t('confirmLocation');

  // ------------------------------------------------------------------- nav
  String get home => _t('home');
  String get categories => _t('categories');
  String get deals => _t('deals');
  String get account => _t('account');
  String get cart => _t('cart');

  // ------------------------------------------------------------------ home
  String get searchPrefix => _t('searchPrefix');
  String get whatAreYouLookingFor => _t('whatAreYouLookingFor');
  String get offersForYou => _t('offersForYou');
  String get bestsellers => _t('bestsellers');
  String get shopNow => _t('shopNow');
  String get popularBrands => _t('popularBrands');
  String get trendingPicks => _t('trendingPicks');
  String get inFocus => _t('inFocus');
  String get recentlyViewed => _t('recentlyViewed');

  // ---------------------------------------------------------------- search
  String get recentSearches => _t('recentSearches');
  String get trendingSearches => _t('trendingSearches');
  String get clearAll => _t('clearAll');
  String get exploreMore => _t('exploreMore');
  String get noResultsTitle => _t('noResultsTitle');
  String get noResultsBody => _t('noResultsBody');
  String get suggestions => _t('suggestions');
  String get newArrivals => _t('newArrivals');
  String get highlyRated => _t('highlyRated');
  String get sort => _t('sort');
  String get filter => _t('filter');
  String get results => _t('results');

  // --------------------------------------------------------------- product
  String get addToCart => _t('addToCart');
  String get qty => _t('qty');
  String get deliveryInformation => _t('deliveryInformation');
  String get productOverview => _t('productOverview');
  String get description => _t('description');
  String get highlights => _t('highlights');
  String get additionalInformation => _t('additionalInformation');
  String get ratingsAndReviews => _t('ratingsAndReviews');
  String get allReviews => _t('allReviews');
  String get verifiedPurchase => _t('verifiedPurchase');
  String get relatedProducts => _t('relatedProducts');
  String get bestsellersInCategory => _t('bestsellersInCategory');
  String get express => _t('express');
  String get bestSeller => _t('bestSeller');
  String get sellingOutFast => _t('sellingOutFast');
  String get freeReturns => _t('freeReturns');
  String get freeShippingAbove => _t('freeShippingAbove');
  String get secureTransaction => _t('secureTransaction');
  String get highRatedSeller => _t('highRatedSeller');

  // ------------------------------------------------------------------ cart
  String get cartEmptyTitle => _t('cartEmptyTitle');
  String get cartEmptySubtitle => _t('cartEmptySubtitle');
  String get startShopping => _t('startShopping');
  String get bestsellersForYou => _t('bestsellersForYou');
  String get orderSummary => _t('orderSummary');
  String get subtotal => _t('subtotal');
  String get deliveryFee => _t('deliveryFee');
  String get discountLabel => _t('discountLabel');
  String get total => _t('total');
  String get checkout => _t('checkout');
  String get free => _t('free');
  String get remove => _t('remove');
  String get moveToWishlist => _t('moveToWishlist');

  // --------------------------------------------------------------- account
  String get loginSignUp => _t('loginSignUp');
  String get accountHeadline => _t('accountHeadline');
  String get accountSubtitle => _t('accountSubtitle');
  String get orders => _t('orders');
  String get wishlist => _t('wishlist');
  String get paymentMethods => _t('paymentMethods');
  String get currency => _t('currency');
  String get languageLabel => _t('language');
  String get country => _t('country');
  String get notifications => _t('notifications');
  String get help => _t('help');
  String get settings => _t('settings');
  String get logout => _t('logout');
  String get policies => _t('policies');
  String get profile => _t('profile');
  String get wishlistEmptyTitle => _t('wishlistEmptyTitle');
  String get wishlistEmptyBody => _t('wishlistEmptyBody');
  String get ordersEmptyTitle => _t('ordersEmptyTitle');
  String get ordersEmptyBody => _t('ordersEmptyBody');

  // ---------------------------------------------------------------- states
  String get somethingWentWrong => _t('somethingWentWrong');
  String get somethingWentWrongBody => _t('somethingWentWrongBody');
  String get nothingHere => _t('nothingHere');

  static const Map<String, Map<String, String>> _tables = {
    'en': {
      'appName': 'Direct2Kariakoo',
      'brandShort': 'D2K',
      'continue': 'Continue',
      'skip': 'Skip',
      'cancel': 'Cancel',
      'done': 'Done',
      'save': 'Save',
      'retry': 'Try again',
      'viewAll': 'View all',
      'refresh': 'Refresh',
      'tryAgain': 'Try again',
      'nothingHereYet': 'Nothing here yet',
      'storefrontEmptyHint':
          'The storefront has no published items right now. Pull down to refresh.',
      'couldNotLoad': "Couldn't load",
      'productsLabel': 'Products',
      'noProductsFound': 'No products found',
      'noResultsHint': 'Try a different spelling or a broader search.',
      'aboutThisItem': 'About this item',
      'specifications': 'Specifications',
      'noDescription': 'The seller has not added a description for this item.',
      'soldBy': 'Sold by',
      'verifiedSeller': 'Verified',
      'contactSeller': 'Contact seller',
      'chatWithSeller': 'Chat',
      'callSeller': 'Call',
      'whatsapp': 'WhatsApp',
      'visitStore': 'Visit store',
      'phoneUnavailable': 'Phone number unavailable',
      'outOfStock': 'Out of stock',
      'inStock': 'In stock',
      'messages': 'Messages',
      'noMessagesYet': 'No messages yet',
      'startConversation': 'Ask the seller about this item.',
      'typeAMessage': 'Type a message',
      'signInToChat': 'Sign in to message this seller.',
      'addresses': 'Addresses',
      'noAddresses': 'No saved addresses',
      'addAddress': 'Add address',
      'deliverHere': 'Deliver here',
      'cashOnDelivery': 'Cash on delivery',
      'comingSoon': 'Coming soon',
      'placeOrder': 'Place order',
      'orderPlaced': 'Order placed',
      'myOrders': 'My orders',
      'noOrders': 'No orders yet',
      'signInToContinue': 'Sign in to continue',
      'viewAllCaps': 'VIEW ALL',
      'allDeals': 'All deals',
      'seeMore': 'See more',
      'backToTop': 'Back to top',
      'selectYourCountry': 'Select your country',
      'selectYourCity': 'Select your city',
      'deliverTo': 'Deliver to',
      'searchYourLocation': 'Search for your location',
      'searchBuildingArea': 'Search for your building, area…',
      'zoomIn': 'Zoom in',
      'zoomInHint': 'Pinch in or search to find your location',
      'confirmLocation': 'Confirm location',
      'home': 'Home',
      'categories': 'Categories',
      'deals': 'Deals',
      'account': 'Account',
      'cart': 'Cart',
      'searchPrefix': 'Search',
      'whatAreYouLookingFor': 'What are you looking for?',
      'offersForYou': 'Offers for you',
      'bestsellers': 'Bestsellers',
      'shopNow': 'Shop Now',
      'popularBrands': 'Popular Brands',
      'trendingPicks': 'Trending picks',
      'inFocus': 'In focus',
      'recentlyViewed': 'Recently viewed',
      'recentSearches': 'Recent searches',
      'trendingSearches': 'Trending searches',
      'clearAll': 'Clear all',
      'exploreMore': 'Explore more',
      'noResultsTitle': 'No matches found',
      'noResultsBody':
          'We could not find anything for that search. Try a different keyword.',
      'suggestions': 'Suggestions',
      'newArrivals': 'NEW ARRIVALS',
      'highlyRated': 'HIGHLY-RATED PRODUCTS',
      'sort': 'Sort',
      'filter': 'Filter',
      'results': 'results',
      'addToCart': 'Add to cart',
      'qty': 'QTY',
      'deliveryInformation': 'Delivery Information',
      'productOverview': 'Product Overview',
      'description': 'Description',
      'highlights': 'Highlights',
      'additionalInformation': 'Additional Information',
      'ratingsAndReviews': 'Ratings & Reviews',
      'allReviews': 'All reviews',
      'verifiedPurchase': 'Verified Purchase',
      'relatedProducts': 'You may also like',
      'bestsellersInCategory': 'Bestsellers in this category',
      'express': 'express',
      'bestSeller': 'Best Seller',
      'sellingOutFast': 'Selling out fast',
      'freeReturns': 'Easy and hassle free returns',
      'freeShippingAbove': 'Free shipping on orders above',
      'secureTransaction': 'Secure Transaction',
      'highRatedSeller': 'High Rated Seller',
      'cartEmptyTitle': 'Your shopping cart looks empty.',
      'cartEmptySubtitle': 'What are you waiting for?',
      'startShopping': 'Start Shopping',
      'bestsellersForYou': 'Bestsellers for you',
      'orderSummary': 'Order summary',
      'subtotal': 'Subtotal',
      'deliveryFee': 'Delivery fee',
      'discountLabel': 'Discount',
      'total': 'Total',
      'checkout': 'Checkout',
      'free': 'FREE',
      'remove': 'Remove',
      'moveToWishlist': 'Move to wishlist',
      'loginSignUp': 'Login/Sign up',
      'accountHeadline': '2M+ products\nfrom trusted sellers',
      'accountSubtitle': 'Straight from Kariakoo to every door, every day.',
      'orders': 'Orders',
      'wishlist': 'Wishlist',
      'paymentMethods': 'Payment methods',
      'currency': 'Currency',
      'language': 'Language',
      'country': 'Country',
      'notifications': 'Notifications',
      'help': 'Help & support',
      'settings': 'Settings',
      'logout': 'Log out',
      'policies': 'Policies',
      'profile': 'Profile',
      'wishlistEmptyTitle': 'Your wishlist is empty',
      'wishlistEmptyBody': 'Tap the heart on any product to save it here.',
      'ordersEmptyTitle': 'No orders yet',
      'ordersEmptyBody': 'Your D2K orders will appear here once you check out.',
      'somethingWentWrong': 'Something went wrong',
      'somethingWentWrongBody':
          'We could not load this right now. Please try again.',
      'nothingHere': 'Nothing here yet',
    },
    'sw': {
      'appName': 'Direct2Kariakoo',
      'brandShort': 'D2K',
      'continue': 'Endelea',
      'skip': 'Ruka',
      'cancel': 'Ghairi',
      'done': 'Tayari',
      'save': 'Hifadhi',
      'retry': 'Jaribu tena',
      'viewAll': 'Ona zote',
      'refresh': 'Onyesha upya',
      'tryAgain': 'Jaribu tena',
      'nothingHereYet': 'Bado hakuna kitu hapa',
      'storefrontEmptyHint':
          'Hakuna bidhaa zilizochapishwa kwa sasa. Vuta chini kuonyesha upya.',
      'couldNotLoad': 'Imeshindikana kupakia',
      'productsLabel': 'Bidhaa',
      'noProductsFound': 'Hakuna bidhaa zilizopatikana',
      'noResultsHint': 'Jaribu tahajia nyingine au utafutaji mpana zaidi.',
      'aboutThisItem': 'Kuhusu bidhaa hii',
      'noDescription': 'Muuzaji hajaweka maelezo ya bidhaa hii.',
      'verifiedSeller': 'Amethibitishwa',
      'contactSeller': 'Wasiliana na muuzaji',
      'chatWithSeller': 'Ujumbe',
      'callSeller': 'Piga simu',
      'whatsapp': 'WhatsApp',
      'visitStore': 'Tembelea duka',
      'phoneUnavailable': 'Namba ya simu haipatikani',
      'messages': 'Ujumbe',
      'noMessagesYet': 'Bado hakuna ujumbe',
      'startConversation': 'Muulize muuzaji kuhusu bidhaa hii.',
      'typeAMessage': 'Andika ujumbe',
      'signInToChat': 'Ingia ili kutuma ujumbe kwa muuzaji.',
      'noAddresses': 'Hakuna anwani zilizohifadhiwa',
      'addAddress': 'Ongeza anwani',
      'deliverHere': 'Leta hapa',
      'cashOnDelivery': 'Lipa ukipokea',
      'comingSoon': 'Inakuja hivi karibuni',
      'placeOrder': 'Weka oda',
      'myOrders': 'Oda zangu',
      'noOrders': 'Bado hakuna oda',
      'signInToContinue': 'Ingia ili kuendelea',
      'viewAllCaps': 'ONA ZOTE',
      'allDeals': 'Ofa zote',
      'seeMore': 'Ona zaidi',
      'backToTop': 'Rudi juu',
      'selectYourCountry': 'Chagua nchi yako',
      'selectYourCity': 'Chagua mji wako',
      'deliverTo': 'Peleka kwa',
      'searchYourLocation': 'Tafuta eneo lako',
      'searchBuildingArea': 'Tafuta jengo au eneo lako…',
      'zoomIn': 'Kuza ramani',
      'zoomInHint': 'Kuza au tafuta ili kupata eneo lako',
      'confirmLocation': 'Thibitisha eneo',
      'home': 'Nyumbani',
      'categories': 'Makundi',
      'deals': 'Ofa',
      'account': 'Akaunti',
      'cart': 'Kikapu',
      'searchPrefix': 'Tafuta',
      'whatAreYouLookingFor': 'Unatafuta nini?',
      'offersForYou': 'Ofa kwa ajili yako',
      'bestsellers': 'Zinazouzwa zaidi',
      'shopNow': 'Nunua Sasa',
      'popularBrands': 'Chapa Maarufu',
      'trendingPicks': 'Zinazovuma',
      'inFocus': 'Mwangaza',
      'recentlyViewed': 'Ulizoangalia hivi karibuni',
      'recentSearches': 'Utafutaji wa hivi karibuni',
      'trendingSearches': 'Utafutaji unaovuma',
      'clearAll': 'Futa zote',
      'exploreMore': 'Gundua zaidi',
      'noResultsTitle': 'Hakuna kilichopatikana',
      'noResultsBody': 'Hatukupata kitu kwa utafutaji huo. Jaribu neno lingine.',
      'suggestions': 'Mapendekezo',
      'newArrivals': 'MPYA DUKANI',
      'highlyRated': 'ZENYE ALAMA BORA',
      'sort': 'Panga',
      'filter': 'Chuja',
      'results': 'matokeo',
      'addToCart': 'Weka kikapuni',
      'qty': 'IDADI',
      'deliveryInformation': 'Taarifa za Usafirishaji',
      'productOverview': 'Muhtasari wa Bidhaa',
      'description': 'Maelezo',
      'highlights': 'Vivutio',
      'additionalInformation': 'Taarifa za Ziada',
      'ratingsAndReviews': 'Alama na Maoni',
      'allReviews': 'Maoni yote',
      'verifiedPurchase': 'Ununuzi Uliothibitishwa',
      'relatedProducts': 'Unaweza pia kupenda',
      'bestsellersInCategory': 'Zinazouzwa zaidi katika kundi hili',
      'express': 'express',
      'bestSeller': 'Inayouzwa Zaidi',
      'sellingOutFast': 'Inaisha haraka',
      'freeReturns': 'Kurudisha bidhaa bila usumbufu',
      'freeShippingAbove': 'Usafirishaji bure kwa oda zaidi ya',
      'secureTransaction': 'Malipo Salama',
      'highRatedSeller': 'Muuzaji Bora',
      'cartEmptyTitle': 'Kikapu chako ni kitupu.',
      'cartEmptySubtitle': 'Unasubiri nini?',
      'startShopping': 'Anza Kununua',
      'bestsellersForYou': 'Zinazouzwa zaidi kwako',
      'orderSummary': 'Muhtasari wa oda',
      'subtotal': 'Jumla ndogo',
      'deliveryFee': 'Gharama ya usafirishaji',
      'discountLabel': 'Punguzo',
      'total': 'Jumla',
      'checkout': 'Lipia',
      'free': 'BURE',
      'remove': 'Ondoa',
      'moveToWishlist': 'Hamishia kwenye orodha',
      'loginSignUp': 'Ingia/Jisajili',
      'accountHeadline': 'Bidhaa 2M+\nkutoka kwa wauzaji wa kuaminika',
      'accountSubtitle': 'Moja kwa moja kutoka Kariakoo hadi mlangoni kwako.',
      'orders': 'Oda',
      'wishlist': 'Orodha ya matamanio',
      'paymentMethods': 'Njia za malipo',
      'currency': 'Sarafu',
      'language': 'Lugha',
      'country': 'Nchi',
      'notifications': 'Arifa',
      'help': 'Msaada',
      'settings': 'Mipangilio',
      'logout': 'Toka',
      'policies': 'Sera',
      'profile': 'Wasifu',
      'wishlistEmptyTitle': 'Orodha yako ni tupu',
      'wishlistEmptyBody': 'Gusa moyo kwenye bidhaa yoyote ili kuihifadhi hapa.',
      'ordersEmptyTitle': 'Hakuna oda bado',
      'ordersEmptyBody': 'Oda zako za D2K zitaonekana hapa baada ya kulipia.',
      'somethingWentWrong': 'Kuna hitilafu imetokea',
      'somethingWentWrongBody': 'Hatukuweza kupakia sasa. Tafadhali jaribu tena.',
      'nothingHere': 'Hakuna kitu bado',
      'specifications': 'Vipimo',
      'soldBy': 'Inauzwa na',
      'outOfStock': 'Imeisha',
      'inStock': 'Ipo',
      'addresses': 'Anwani',
      'orderPlaced': 'Oda imewekwa',
    },
    'fr': {
      'appName': 'Direct2Kariakoo',
      'brandShort': 'D2K',
      'continue': 'Continuer',
      'skip': 'Passer',
      'cancel': 'Annuler',
      'done': 'Terminé',
      'save': 'Enregistrer',
      'retry': 'Réessayer',
      'viewAll': 'Voir tout',
      'refresh': 'Actualiser',
      'tryAgain': 'Réessayer',
      'nothingHereYet': 'Rien ici pour le moment',
      'storefrontEmptyHint': 'Aucun article publié pour l\'instant. Tirez vers le bas pour actualiser.',
      'couldNotLoad': 'Chargement impossible',
      'productsLabel': 'Produits',
      'noProductsFound': 'Aucun produit trouvé',
      'noResultsHint': 'Essayez une autre orthographe ou une recherche plus large.',
      'aboutThisItem': 'À propos de cet article',
      'specifications': 'Caractéristiques',
      'noDescription': 'Le vendeur n\'a pas ajouté de description pour cet article.',
      'soldBy': 'Vendu par',
      'verifiedSeller': 'Vérifié',
      'contactSeller': 'Contacter le vendeur',
      'chatWithSeller': 'Discuter',
      'callSeller': 'Appeler',
      'whatsapp': 'WhatsApp',
      'visitStore': 'Voir la boutique',
      'phoneUnavailable': 'Numéro de téléphone indisponible',
      'outOfStock': 'Rupture de stock',
      'inStock': 'En stock',
      'messages': 'Messages',
      'noMessagesYet': 'Aucun message',
      'startConversation': 'Posez une question au vendeur sur cet article.',
      'typeAMessage': 'Écrivez un message',
      'signInToChat': 'Connectez-vous pour écrire au vendeur.',
      'addresses': 'Adresses',
      'noAddresses': 'Aucune adresse enregistrée',
      'addAddress': 'Ajouter une adresse',
      'deliverHere': 'Livrer ici',
      'cashOnDelivery': 'Paiement à la livraison',
      'comingSoon': 'Bientôt disponible',
      'placeOrder': 'Commander',
      'orderPlaced': 'Commande passée',
      'myOrders': 'Mes commandes',
      'noOrders': 'Aucune commande',
      'signInToContinue': 'Connectez-vous pour continuer',
      'viewAllCaps': 'VOIR TOUT',
      'allDeals': 'Toutes les offres',
      'seeMore': 'Voir plus',
      'backToTop': 'Haut de page',
      'selectYourCountry': 'Choisissez votre pays',
      'selectYourCity': 'Choisissez votre ville',
      'deliverTo': 'Livrer à',
      'searchYourLocation': 'Recherchez votre position',
      'searchBuildingArea': 'Bâtiment, rue ou quartier',
      'zoomIn': 'Agrandir',
      'zoomInHint': 'Agrandissez pour placer le repère avec précision',
      'confirmLocation': 'Confirmer la position',
      'home': 'Accueil',
      'categories': 'Catégories',
      'deals': 'Offres',
      'account': 'Compte',
      'cart': 'Panier',
      'searchPrefix': 'Rechercher',
      'whatAreYouLookingFor': 'Que cherchez-vous ?',
      'offersForYou': 'Offres pour vous',
      'bestsellers': 'Meilleures ventes',
      'shopNow': 'Acheter',
      'popularBrands': 'Marques populaires',
      'trendingPicks': 'Tendances',
      'inFocus': 'À la une',
      'recentlyViewed': 'Vus récemment',
      'recentSearches': 'Recherches récentes',
      'trendingSearches': 'Recherches populaires',
      'clearAll': 'Tout effacer',
      'exploreMore': 'Explorer plus',
      'noResultsTitle': 'Aucun résultat',
      'noResultsBody': 'Essayez un autre mot-clé.',
      'suggestions': 'Suggestions',
      'newArrivals': 'Nouveautés',
      'highlyRated': 'Très bien notés',
      'sort': 'Trier',
      'filter': 'Filtrer',
      'results': 'résultats',
      'addToCart': 'Ajouter au panier',
      'qty': 'Qté',
      'deliveryInformation': 'Informations de livraison',
      'productOverview': 'Aperçu du produit',
      'description': 'Description',
      'highlights': 'Points forts',
      'additionalInformation': 'Informations complémentaires',
      'ratingsAndReviews': 'Notes et avis',
      'allReviews': 'Tous les avis',
      'verifiedPurchase': 'Achat vérifié',
      'relatedProducts': 'Produits similaires',
      'bestsellersInCategory': 'Meilleures ventes de la catégorie',
      'express': 'Express',
      'bestSeller': 'Meilleure vente',
      'sellingOutFast': 'Bientôt épuisé',
      'freeReturns': 'Retours gratuits',
      'freeShippingAbove': 'Livraison gratuite dès',
      'secureTransaction': 'Transaction sécurisée',
      'highRatedSeller': 'Vendeur bien noté',
      'cartEmptyTitle': 'Votre panier est vide',
      'cartEmptySubtitle': 'Ajoutez des articles pour commencer.',
      'startShopping': 'Commencer mes achats',
      'bestsellersForYou': 'Meilleures ventes pour vous',
      'orderSummary': 'Récapitulatif',
      'subtotal': 'Sous-total',
      'deliveryFee': 'Frais de livraison',
      'discountLabel': 'Remise',
      'total': 'Total',
      'checkout': 'Passer la commande',
      'free': 'Gratuit',
      'remove': 'Retirer',
      'moveToWishlist': 'Mettre en favoris',
      'loginSignUp': 'Connexion / Inscription',
      'accountHeadline': 'Votre compte D2K',
      'accountSubtitle': 'Commandes, favoris et paramètres',
      'orders': 'Commandes',
      'wishlist': 'Favoris',
      'paymentMethods': 'Moyens de paiement',
      'currency': 'Devise',
      'language': 'Langue',
      'country': 'Pays',
      'notifications': 'Notifications',
      'help': 'Aide',
      'settings': 'Paramètres',
      'logout': 'Déconnexion',
      'policies': 'Conditions',
      'profile': 'Profil',
      'wishlistEmptyTitle': 'Aucun favori',
      'wishlistEmptyBody': 'Touchez le cœur sur un produit pour le retrouver ici.',
      'ordersEmptyTitle': 'Aucune commande',
      'ordersEmptyBody': 'Vos commandes apparaîtront ici.',
      'somethingWentWrong': 'Une erreur s\'est produite',
      'somethingWentWrongBody': 'Vérifiez votre connexion et réessayez.',
      'nothingHere': 'Rien ici',
    },
    'zh': {
      'appName': 'Direct2Kariakoo',
      'brandShort': 'D2K',
      'continue': '继续',
      'skip': '跳过',
      'cancel': '取消',
      'done': '完成',
      'save': '保存',
      'retry': '重试',
      'viewAll': '查看全部',
      'refresh': '刷新',
      'tryAgain': '重试',
      'nothingHereYet': '暂无内容',
      'storefrontEmptyHint': '目前没有已上架的商品。下拉可刷新。',
      'couldNotLoad': '加载失败',
      'productsLabel': '商品',
      'noProductsFound': '未找到商品',
      'noResultsHint': '请尝试其他拼写或更宽泛的搜索。',
      'aboutThisItem': '商品介绍',
      'specifications': '规格参数',
      'noDescription': '卖家尚未填写该商品的描述。',
      'soldBy': '卖家',
      'verifiedSeller': '已认证',
      'contactSeller': '联系卖家',
      'chatWithSeller': '聊天',
      'callSeller': '拨打电话',
      'whatsapp': 'WhatsApp',
      'visitStore': '进入店铺',
      'phoneUnavailable': '暂无电话号码',
      'outOfStock': '缺货',
      'inStock': '有货',
      'messages': '消息',
      'noMessagesYet': '暂无消息',
      'startConversation': '就该商品向卖家提问。',
      'typeAMessage': '输入消息',
      'signInToChat': '登录后可与卖家联系。',
      'addresses': '收货地址',
      'noAddresses': '暂无保存的地址',
      'addAddress': '添加地址',
      'deliverHere': '送到这里',
      'cashOnDelivery': '货到付款',
      'comingSoon': '即将推出',
      'placeOrder': '提交订单',
      'orderPlaced': '订单已提交',
      'myOrders': '我的订单',
      'noOrders': '暂无订单',
      'signInToContinue': '请登录以继续',
      'viewAllCaps': '查看全部',
      'allDeals': '全部优惠',
      'seeMore': '查看更多',
      'backToTop': '回到顶部',
      'selectYourCountry': '选择国家',
      'selectYourCity': '选择城市',
      'deliverTo': '配送至',
      'searchYourLocation': '搜索您的位置',
      'searchBuildingArea': '楼宇、街道或区域',
      'zoomIn': '放大',
      'zoomInHint': '放大以精确放置位置标记',
      'confirmLocation': '确认位置',
      'home': '首页',
      'categories': '分类',
      'deals': '优惠',
      'account': '我的',
      'cart': '购物车',
      'searchPrefix': '搜索',
      'whatAreYouLookingFor': '您在找什么？',
      'offersForYou': '为您推荐的优惠',
      'bestsellers': '热销商品',
      'shopNow': '立即购买',
      'popularBrands': '热门品牌',
      'trendingPicks': '热门精选',
      'inFocus': '焦点推荐',
      'recentlyViewed': '最近浏览',
      'recentSearches': '最近搜索',
      'trendingSearches': '热门搜索',
      'clearAll': '全部清除',
      'exploreMore': '探索更多',
      'noResultsTitle': '没有结果',
      'noResultsBody': '请尝试其他关键词。',
      'suggestions': '搜索建议',
      'newArrivals': '新品上架',
      'highlyRated': '高评分',
      'sort': '排序',
      'filter': '筛选',
      'results': '条结果',
      'addToCart': '加入购物车',
      'qty': '数量',
      'deliveryInformation': '配送信息',
      'productOverview': '商品概览',
      'description': '商品描述',
      'highlights': '亮点',
      'additionalInformation': '更多信息',
      'ratingsAndReviews': '评分与评价',
      'allReviews': '全部评价',
      'verifiedPurchase': '已验证购买',
      'relatedProducts': '相关商品',
      'bestsellersInCategory': '该分类热销',
      'express': '快速配送',
      'bestSeller': '热销',
      'sellingOutFast': '即将售罄',
      'freeReturns': '免费退货',
      'freeShippingAbove': '满额免运费',
      'secureTransaction': '安全交易',
      'highRatedSeller': '高评分卖家',
      'cartEmptyTitle': '购物车是空的',
      'cartEmptySubtitle': '添加商品即可开始。',
      'startShopping': '开始购物',
      'bestsellersForYou': '为您推荐的热销',
      'orderSummary': '订单摘要',
      'subtotal': '小计',
      'deliveryFee': '运费',
      'discountLabel': '优惠',
      'total': '合计',
      'checkout': '去结算',
      'free': '免费',
      'remove': '移除',
      'moveToWishlist': '移入收藏',
      'loginSignUp': '登录 / 注册',
      'accountHeadline': '您的 D2K 账户',
      'accountSubtitle': '订单、收藏与设置',
      'orders': '订单',
      'wishlist': '收藏',
      'paymentMethods': '支付方式',
      'currency': '货币',
      'language': '语言',
      'country': '国家',
      'notifications': '通知',
      'help': '帮助',
      'settings': '设置',
      'logout': '退出登录',
      'policies': '条款与政策',
      'profile': '个人资料',
      'wishlistEmptyTitle': '暂无收藏',
      'wishlistEmptyBody': '点击商品上的心形图标即可收藏。',
      'ordersEmptyTitle': '暂无订单',
      'ordersEmptyBody': '您的订单会显示在这里。',
      'somethingWentWrong': '出错了',
      'somethingWentWrongBody': '请检查网络后重试。',
      'nothingHere': '暂无内容',
    },
  };
}

/// Inherited access point so a language change rebuilds every dependent widget.
class StringsScope extends InheritedWidget {
  const StringsScope({
    super.key,
    required this.strings,
    required super.child,
  });

  final AppStrings strings;

  static StringsScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<StringsScope>();
    assert(scope != null, 'StringsScope is missing above this widget');
    return scope!;
  }

  @override
  bool updateShouldNotify(StringsScope oldWidget) =>
      oldWidget.strings.language != strings.language;
}

extension StringsContext on BuildContext {
  AppStrings get strings => AppStrings.of(this);
}
