/// Strings that exist only in the mobile app.
///
/// The website's dictionaries are the source of every phrase 2KONECT already
/// says, and they are ported wholesale — see `en.dart` and its siblings. A
/// handful of things, though, only a phone has to say: sharing a product,
/// recent searches, confirming a sign-out. Those live here, in all four
/// languages, under the `app.` prefix so it is always obvious which is which.
///
/// This is not a second translation system. It is the same lookup, the same
/// keys, the same `t()` — merely the part of the vocabulary the website had no
/// reason to own.
library;

const Map<String, Map<String, String>> mobileDictionaries = {
  'en': {
    'app.passwordsDiffer': 'Both passwords must match.',
    'app.googleSetupHint': 'This build has no Firebase configuration for Android or iOS yet. Email and password sign-in works normally.',
    'app.inCart': '{count} in cart',
    'app.documentsOnWeb': 'Documents are uploaded in the seller console at 2konect.shop, where a preview makes the review worth a person\'s time.',
    'app.helpAndLegal': 'Help and legal',
    'app.openInBrowser': 'Opens 2konect.shop in your browser',
    'app.storeAndVerification': 'Store and verification',
    'app.share': 'Share',
    'app.more': 'More',
    'app.recentSearches': 'Recent searches',
    'app.clearCartConfirm': 'Remove everything from your cart?',
    'app.signOutConfirm': 'You can sign back in at any time. Your cart stays on this phone.',
    'app.deliveryAtCheckout': 'Added at checkout',
    'app.languageNotCurrency':
        'Changing the language does not change the currency. 2KONECT prices in Tanzanian Shillings, and product names stay in the seller’s own words.',
    'app.stepOf': 'Step {step} of {total}',
    'app.quoted': 'Price quoted',
    'app.earnings': 'Earnings',
    'app.paidOut': 'Paid out',
  },
  'sw': {
    'app.passwordsDiffer': 'Manenosiri yote mawili lazima yafanane.',
    'app.googleSetupHint': 'Toleo hili bado halina usanidi wa Firebase kwa Android au iOS. Kuingia kwa barua pepe na nenosiri kunafanya kazi kama kawaida.',
    'app.inCart': '{count} kikapuni',
    'app.documentsOnWeb': 'Nyaraka hupakiwa kwenye kituo cha muuzaji katika 2konect.shop, ambapo hakiki hurahisisha ukaguzi.',
    'app.helpAndLegal': 'Msaada na sheria',
    'app.openInBrowser': 'Hufungua 2konect.shop kwenye kivinjari chako',
    'app.storeAndVerification': 'Duka na uthibitisho',
    'app.share': 'Shiriki',
    'app.more': 'Zaidi',
    'app.recentSearches': 'Utafutaji wa hivi karibuni',
    'app.clearCartConfirm': 'Ondoa kila kitu kwenye kikapu chako?',
    'app.signOutConfirm':
        'Unaweza kuingia tena wakati wowote. Kikapu chako kinabaki kwenye simu hii.',
    'app.deliveryAtCheckout': 'Huongezwa wakati wa malipo',
    'app.languageNotCurrency':
        'Kubadilisha lugha hakubadilishi sarafu. 2KONECT hutoa bei kwa Shilingi ya Tanzania, na majina ya bidhaa hubaki kama muuzaji alivyoandika.',
    'app.stepOf': 'Hatua {step} kati ya {total}',
    'app.quoted': 'Bei imetolewa',
    'app.earnings': 'Mapato',
    'app.paidOut': 'Yaliyolipwa',
  },
  'fr': {
    'app.passwordsDiffer': 'Les deux mots de passe doivent être identiques.',
    'app.googleSetupHint': 'Cette version n\'a pas encore de configuration Firebase pour Android ou iOS. La connexion par e-mail et mot de passe fonctionne normalement.',
    'app.inCart': '{count} au panier',
    'app.documentsOnWeb': 'Les documents se téléversent dans la console vendeur sur 2konect.shop, où un aperçu rend l\'examen plus utile.',
    'app.helpAndLegal': 'Aide et mentions légales',
    'app.openInBrowser': 'Ouvre 2konect.shop dans votre navigateur',
    'app.storeAndVerification': 'Boutique et vérification',
    'app.share': 'Partager',
    'app.more': 'Plus',
    'app.recentSearches': 'Recherches récentes',
    'app.clearCartConfirm': 'Vider entièrement votre panier ?',
    'app.signOutConfirm':
        'Vous pouvez vous reconnecter à tout moment. Votre panier reste sur ce téléphone.',
    'app.deliveryAtCheckout': 'Ajoutés au paiement',
    'app.languageNotCurrency':
        'Changer de langue ne change pas la devise. 2KONECT affiche ses prix en shillings tanzaniens, et les noms de produits restent tels que le vendeur les a écrits.',
    'app.stepOf': 'Étape {step} sur {total}',
    'app.quoted': 'Prix communiqué',
    'app.earnings': 'Revenus',
    'app.paidOut': 'Versé',
  },
  'zh': {
    'app.passwordsDiffer': '两次输入的密码必须一致。',
    'app.googleSetupHint': '此版本尚未配置 Android 或 iOS 的 Firebase。邮箱与密码登录可正常使用。',
    'app.inCart': '购物车 {count} 件',
    'app.documentsOnWeb': '证件请在 2konect.shop 的卖家后台上传，那里可以预览，审核更有效率。',
    'app.helpAndLegal': '帮助与法律条款',
    'app.openInBrowser': '在浏览器中打开 2konect.shop',
    'app.storeAndVerification': '店铺与认证',
    'app.share': '分享',
    'app.more': '更多',
    'app.recentSearches': '最近搜索',
    'app.clearCartConfirm': '清空购物车中的所有商品？',
    'app.signOutConfirm': '您可以随时重新登录。购物车会保留在这部手机上。',
    'app.deliveryAtCheckout': '结算时添加',
    'app.languageNotCurrency': '切换语言不会更改货币。2KONECT 以坦桑尼亚先令计价，商品名称保持卖家原文。',
    'app.stepOf': '第 {step} 步，共 {total} 步',
    'app.quoted': '已报价',
    'app.earnings': '收入',
    'app.paidOut': '已结算',
  },
};
