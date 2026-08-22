/**
 * Copy for 2KONECT's written pages — legal, help and company.
 *
 * Kept apart from the interface dictionary because it is long-form prose that
 * changes on a different rhythm to button labels, and because every language
 * must carry the same section structure. `PageContent` below is derived from
 * the English entry, so a page added in one language and forgotten in another
 * is a compile error rather than a half-translated policy.
 */

export interface PageSection {
  heading: string;
  body?: string[];
  points?: string[];
}

export interface PageTopic {
  name: string;
  description: string;
  href: string;
}

export interface PageCopy {
  title: string;
  updated?: string;
  intro?: string;
  empty?: string;
  productsLabel?: string;
  sinceLabel?: string;
  topics?: PageTopic[];
  sections: PageSection[];
}

export const enPages = {
    privacy: {
      title: "Privacy policy",
      updated: "Last updated August 2026",
      intro: "This policy explains what 2KONECT collects when you use the marketplace, why we collect it, and the choices you have.",
      sections: [
      { heading: "Information we collect", body: ["We collect the details you give us when you create an account, place an order, request a product or contact support."], points: ["Your name, email address and phone number.", "Delivery addresses you save, including a map location if you choose one.", "Orders you place, their fulfilment route and their delivery status.", "Sourcing requests you send us, including any photograph you attach.", "Messages you send to sellers or to our support team."] },
      { heading: "How we use your information", body: ["We use your information to run the marketplace, to import what you order and to deliver it."], points: ["Processing and delivering your orders.", "Sourcing, importing and clearing products you have ordered from abroad.", "Sharing delivery details with the seller, courier or rider handling your parcel.", "Answering your support requests and sourcing enquiries.", "Keeping accounts and payments secure."] },
      { heading: "Sellers", body: ["2KONECT is a marketplace. When you buy, the seller receives the information they need to prepare and deliver your order — your name, phone number and delivery address. Sellers may not use it for anything else."] },
      { heading: "International orders", body: ["An order sourced from abroad has to cross a border. Where a carrier or a customs authority requires the recipient's name, phone number and address to bring a shipment into Tanzania, we provide exactly that and nothing more."] },
      { heading: "Payments", body: ["Cash on delivery is handled directly between you and the rider. We do not store card details. When mobile money becomes available, payments will be handled by the provider and we will only receive confirmation of the result."] },
      { heading: "Cookies and local storage", body: ["We store your language, delivery location, cart and sign-in session in your browser so the site works between visits. See our cookie policy for detail."] },
      { heading: "Sharing", body: ["We share information only where it is needed to complete your order or where the law requires it. We do not sell your personal information."] },
      { heading: "Security", body: ["Passwords are stored hashed and access to customer data is restricted to staff who need it. No system is perfectly secure, so please use a strong, unique password."] },
      { heading: "Your rights", body: ["You can view and change your account details and saved addresses at any time from your account. To request a copy of your data or ask us to delete your account, contact us."] },
      { heading: "Children", body: ["Accounts are intended for adults. We do not knowingly collect information from children."] },
      { heading: "Contact", body: ["Questions about this policy can be sent to our support team."] },
      ],
    },
    terms: {
      title: "Terms and conditions",
      updated: "Last updated August 2026",
      intro: "These terms cover your use of 2KONECT. By using the marketplace you agree to them.",
      sections: [
      { heading: "About the marketplace", body: ["2KONECT is a marketplace with two ways to buy. Some products are already in Tanzania and are sold and shipped by the seller who holds them. Others are sourced from suppliers abroad, imported by 2KONECT and delivered to you. Every listing says which it is, together with the delivery window it carries."] },
      { heading: "Your account", body: ["You are responsible for keeping your password private and for activity on your account. Give accurate contact and delivery details — orders fail most often because a phone number or address is wrong."] },
      { heading: "Orders", body: ["Placing an order is an offer to buy. An order is confirmed when the seller accepts it, or in the case of an imported product when we confirm the sourcing. If an item turns out to be unavailable, the order is cancelled and any reserved stock is released."] },
      { heading: "Delivery estimates", body: ["Each product carries an estimated delivery window, and the order you place records the window you were shown. Estimates are honest expectations rather than guarantees: an international shipment depends on the carrier, on customs and on conditions we do not control. We tell you as soon as an estimate changes."] },
      { heading: "Prices", body: ["Prices are shown in Tanzanian shillings. A product available both locally and from abroad carries two prices, and you choose which you are buying before you pay. Prices and availability can change at any time before an order is confirmed."] },
      { heading: "Import duties and charges", body: ["The price shown for an imported product covers sourcing, international shipping and delivery within Tanzania unless the listing states otherwise. Where an authority levies a charge that could not reasonably have been anticipated, we will tell you before anything is paid and you may cancel."] },
      { heading: "Payment", body: ["How you pay depends on what you are buying. Anything already in Tanzania can be paid for on delivery — you pay the rider when it arrives. Anything we order from abroad is paid for before we buy it, using Lipa Namba or mobile money, and delivery for those orders is arranged separately once the goods have landed."] },
      { heading: "Delivery and collection", body: ["We deliver across Dar es Salaam and to other regions where a courier route exists. When an imported order reaches Tanzania you choose how it reaches you: a 2KONECT rider brings it, or you collect it from one of our points."] },
      { heading: "Sourcing requests", body: ["You can ask us to find a product the catalogue does not carry. A request is not an order: we source it, quote you a price and a date, and nothing is bought until you accept."] },
      { heading: "Cancellations, returns and refunds", body: ["You can cancel an order from your account while it is still pending or being prepared. Once an imported order has been dispatched from the supplier it can no longer be cancelled, because it has already been bought on your behalf. After delivery, contact support about a return; see our returns page for what qualifies and how long you have."] },
      { heading: "Sellers", body: ["Sellers are responsible for their listings, stock, prices and the condition of what they send. Stores are reviewed before going live, and we may suspend a store that misrepresents products or fails to fulfil orders."] },
      { heading: "Prohibited use", body: ["You may not use the marketplace to sell illegal or counterfeit goods, to abuse other users or sellers, to interfere with the service, or to collect data from it automatically without permission."] },
      { heading: "Ending an account", body: ["You may close your account at any time. We may suspend or close an account that breaches these terms."] },
      { heading: "Contact", body: ["Questions about these terms can be sent to our support team."] },
      ],
    },
    cookies: {
      title: "Cookie policy",
      updated: "Last updated August 2026",
      intro: "2KONECT stores a small amount of information in your browser so the site remembers you between visits.",
      sections: [
      { heading: "What we store", body: ["We keep these in your browser's local storage rather than in tracking cookies."], points: ["Your chosen language.", "Your delivery location.", "Your shopping cart, including which buying option you chose for each item.", "Your sign-in session, so you are not asked to log in on every page."] },
      { heading: "What we do not do", body: ["We do not use advertising or cross-site tracking cookies, and we do not sell browsing data."] },
      { heading: "Managing them", body: ["You can clear this at any time through your browser's site settings. Doing so signs you out and empties your cart."] },
      { heading: "Changes", body: ["If we add analytics or advertising in future, this page will be updated before it goes live."] },
      ],
    },
    delivery: {
      title: "Delivery and shipping",
      intro: "How your order reaches you — whether it starts in Dar es Salaam or in Shenzhen.",
      sections: [
      { heading: "Two routes, one order page", body: ["A product already in Tanzania ships from the seller straight to you, usually within one to three days. A product ordered from abroad is bought by us, flown or shipped in, cleared, and then delivered locally. Both are tracked on the same order page."] },
      { heading: "What the journey looks like", body: ["A local order moves through confirmed, shipped, out for delivery and delivered. An imported order adds the stops in between: dispatched by the supplier, in transit, arrived in Tanzania, clearing customs, at our warehouse, then out for delivery. Each step appears on your order as it actually happens."], },
      { heading: "How long it takes", body: ["Local stock in Dar es Salaam usually arrives within one to three working days. Imported orders depend on the route: air freight typically takes seven to fourteen days, sea freight thirty to forty-five. Every listing shows its own window, and your order records the window you were promised."] },
      { heading: "Where we deliver", body: ["We deliver across Dar es Salaam and to other regions of Tanzania where a courier route exists. You choose your delivery point on a map when you save an address, so the rider knows exactly where to go."] },
      { heading: "Delivery charge", body: ["The delivery charge is shown at checkout before you place the order, so there is never a surprise on arrival. Collecting from a 2KONECT point is free."] },
      { heading: "Choosing delivery or collection", body: ["When an imported order reaches Tanzania you decide how it gets to you. Arrange a 2KONECT Rides delivery to your address, or reserve it for collection at one of our points, from the order page."] },
      { heading: "When the rider arrives", body: ["Keep the phone number on your order reachable — the rider calls when close. With cash on delivery, pay the rider the amount shown on your order."] },
      ],
    },
    returns: {
      title: "Returns and refunds",
      intro: "What to do if something arrives damaged, faulty or not as described.",
      sections: [
      { heading: "Before it ships", body: ["While an order is still pending or being prepared you can cancel it yourself from the order page. Local stock goes straight back on sale."] },
      { heading: "Imported orders", body: ["An imported order can be cancelled up until the supplier dispatches it. After that it has already been bought and paid for on your behalf, so it follows the normal returns process instead."] },
      { heading: "After delivery", body: ["If an item is damaged, faulty or clearly not what was listed, contact support within seven days of delivery. Keep the item and its packaging, and send photographs — they settle most cases quickly."] },
      { heading: "What can be returned", body: ["Items must be unused and in their original packaging, unless the fault is the reason for the return."], points: ["Damaged or faulty on arrival.", "Wrong item or wrong size sent.", "Materially different from the listing."] },
      { heading: "What cannot be returned", body: ["For hygiene and safety reasons some items cannot be returned once opened."], points: ["Cosmetics and personal care once the seal is broken.", "Underwear and swimwear.", "Perishable goods.", "Items made or configured to your specification."] },
      { heading: "Refunds", body: ["Cash-on-delivery orders are refunded in cash once the returned item reaches the seller or our warehouse and is checked. We will tell you the outcome as soon as it is confirmed."] },
      ],
    },
    contact: {
      title: "Contact us",
      intro: "Talk to a person about an order, a delivery, a sourcing request or your account.",
      sections: [
      { heading: "Customer support", body: ["Email or call us and include your reference so we can find it straight away. Order references begin with 2K, sourcing requests with 2KR and deliveries with 2KD."] },
      { heading: "Sourcing enquiries", body: ["If you are looking for something the catalogue does not carry, send a request rather than an email — a request goes straight to the sourcing desk with your photograph and quantity attached."] },
      { heading: "Selling with 2KONECT", body: ["If you are a seller or want to become one, our seller support page covers applications, approvals and managing your store."] },
      { heading: "Response times", body: ["We answer during business hours, Monday to Saturday. Messages sent late in the day are usually answered the next working morning."] },
      { heading: "Where we are", body: ["2KONECT is based in Dar es Salaam, Tanzania."] },
      ],
    },
    about: {
      title: "Who we are",
      intro: "2KONECT connects people in Tanzania to what they need — whether it is already here, or halfway around the world.",
      sections: [
      { heading: "What we do", body: ["Most of what Tanzania buys is imported, and buying it usually means either paying a local markup or trusting a stranger with a transfer. 2KONECT does both properly: you can buy what is already in the country and have it in days, or order the same thing from abroad for less and watch it travel."] },
      { heading: "Two ways to buy", body: ["Every listing says where the product is. Available in Tanzania means a seller is holding it and it ships now. Order from abroad means we buy it from the supplier, import it and deliver it to you — at a lower price, over a longer window, with every step recorded."] },
      { heading: "If we don't list it, ask", body: ["Our sourcing desk finds products the catalogue does not carry. Send a photo and a description; we find it, price it and bring it in. Nothing is ordered until you agree the price."] },
      { heading: "Our sellers", body: ["Nobody becomes a seller here by registering. Every application is read by an administrator, and only approval creates a store. Sellers we have checked carry a verified badge on their listings."] },
      { heading: "Where we deliver", body: ["Dar es Salaam first, and other regions of Tanzania where a courier route exists. We source from China, the UAE, Türkiye, the United Kingdom, the United States and beyond."] },
      ],
    },
    guidelines: {
      title: "Seller guidelines",
      intro: "What we expect from stores selling on 2KONECT.",
      sections: [
      { heading: "Listing your products", body: ["List only stock you actually hold and can dispatch, or products you can genuinely source. Use your own clear photographs of the real item, and describe it accurately — size, colour, condition and what is included."] },
      { heading: "Saying where it is", body: ["Every listing must state honestly whether the stock is in Tanzania or sourced from abroad, and carry a delivery window you can keep. Marking an imported product as locally available is the fastest way to lose your store."] },
      { heading: "Pricing", body: ["Set prices in Tanzanian shillings, including any charges you expect the buyer to cover. Do not inflate a price in order to advertise a discount."] },
      { heading: "Keeping stock accurate", body: ["Update stock as it sells elsewhere. Cancelled orders caused by stock that was never there are the fastest way to lose a customer, and repeated cancellations put your store at risk."] },
      { heading: "Fulfilling orders", body: ["Confirm and prepare orders promptly, and move each one forward as it happens, so the buyer's tracking reflects reality. An imported order has more stages, and each should be marked when it actually occurs."] },
      { heading: "What is not allowed", points: ["Counterfeit or illegally imported goods.", "Unsafe, expired or recalled products.", "Misleading photographs, titles, descriptions or delivery estimates.", "Taking payment or moving buyers off the platform."] },
      { heading: "Approval and suspension", body: ["New stores are reviewed before going live. Stores that mislead buyers or fail to fulfil orders may be suspended."] },
      ],
    },
    sellersupport: {
      title: "Seller support",
      intro: "Help for stores selling on 2KONECT.",
      sections: [
      { heading: "Applying to sell", body: ["Apply from the sell page. You will need your business or store name, your contact details and, where you have one, your NIDA or registration number. An administrator reads every application — approval is what creates your store."] },
      { heading: "While you wait", body: ["Applying is free and there are no listing fees while your application is being reviewed. We contact you as soon as a decision is made."] },
      { heading: "Listing local and imported stock", body: ["Each product asks where it is. Choose 'in Tanzania' for stock you hold, or 'from abroad' for products you source on order, and set a delivery window you can keep. Buyers filter on exactly this."] },
      { heading: "Managing your store", body: ["Your dashboard shows orders, earnings, units sold and which products are running low. Add and edit products from the products screen."] },
      { heading: "Orders and payouts", body: ["Move each order forward as you handle it — the buyer's tracking is built from what you record. Earnings are tracked in your dashboard against completed orders."] },
      { heading: "Getting help", body: ["Contact our team with your store name and, where relevant, the order reference."] },
      ],
    },
    help: {
      title: "Help centre",
      intro: "Find an answer, or talk to our support team.",
      topics: [
        { name: "Orders and tracking", description: "Placing an order and following it to your door.", href: "/account/orders" },
        { name: "Ordering from abroad", description: "How importing works, and how long it takes.", href: "/shop/abroad" },
        { name: "Delivery and collection", description: "Where we deliver, how long it takes and what it costs.", href: "/help/delivery" },
        { name: "Request a product", description: "Ask us to source something we don't list.", href: "/request" },
        { name: "Returns and refunds", description: "Damaged, faulty or incorrect items.", href: "/help/returns" },
        { name: "Payments", description: "Cash on delivery, and what is coming next.", href: "/legal/terms" },
        { name: "Your account", description: "Sign in, addresses and personal details.", href: "/account" },
        { name: "Selling with 2KONECT", description: "Applying, approvals and managing a store.", href: "/sell/support" },
        { name: "Contact support", description: "Talk to a person about your order.", href: "/help/contact" },
      ],
      sections: [
      ],
    },
    vendors: {
      title: "Our sellers",
      intro: "Approved stores trading on 2KONECT. Every one is reviewed before its products go live.",
      empty: "No sellers to show yet.",
      productsLabel: "products",
      sinceLabel: "Selling since {year}",
      sections: [
      ],
    },
};

export type PageKey = keyof typeof enPages;

export const swPages: Record<PageKey, PageCopy> = {
    privacy: {
      title: "Sera ya faragha",
      updated: "Ilisasishwa Agosti 2026",
      intro: "Sera hii inaeleza taarifa gani 2KONECT hukusanya unapotumia soko, kwa nini tunazikusanya, na chaguo ulizo nazo.",
      sections: [
      { heading: "Taarifa tunazokusanya", body: ["Tunakusanya taarifa unazotupa unapofungua akaunti, unapoweka oda au unapowasiliana na msaada."], points: ["Jina lako, barua pepe na namba ya simu.", "Anwani za usafirishaji unazohifadhi, pamoja na eneo la ramani ukilichagua.", "Oda unazoweka na hali ya usafirishaji wake.", "Ujumbe unaotuma kwa wauzaji au kwa timu yetu ya msaada."] },
      { heading: "Jinsi tunavyotumia taarifa zako", body: ["Tunatumia taarifa zako kuendesha soko na kukufikishia ulichoagiza."], points: ["Kushughulikia na kupeleka oda zako.", "Kumpa muuzaji na dereva taarifa zinazohitajika kwa usafirishaji.", "Kujibu maswali yako ya msaada.", "Kulinda usalama wa akaunti na malipo."] },
      { heading: "Wauzaji", body: ["2KONECT ni soko. Ununuapo, muuzaji hupokea taarifa anazohitaji kuandaa na kupeleka oda yako — jina lako, namba ya simu na anwani. Hairuhusiwi kuzitumia kwa jambo lingine."] },
      { heading: "Malipo", body: ["Kulipa ukipokea hufanyika moja kwa moja kati yako na dereva. Hatuhifadhi taarifa za kadi. Pesa ya simu itakapopatikana, malipo yatashughulikiwa na mtoa huduma na sisi tutapokea uthibitisho wa matokeo pekee."] },
      { heading: "Vidakuzi na hifadhi ya kivinjari", body: ["Tunahifadhi lugha yako, eneo la usafirishaji, kikapu na kipindi chako cha kuingia ndani ya kivinjari ili tovuti ifanye kazi kati ya matembezi. Ona sera yetu ya vidakuzi."] },
      { heading: "Kushirikisha", body: ["Tunashirikisha taarifa pale tu inapohitajika kukamilisha oda yako au pale sheria inapotutaka. Hatuuzi taarifa zako binafsi."] },
      { heading: "Usalama", body: ["Manenosiri huhifadhiwa yakiwa yamefichwa na taarifa za wateja hufikiwa na wafanyakazi wanaohitaji pekee. Hakuna mfumo ulio salama kabisa, hivyo tumia nenosiri imara na la kipekee."] },
      { heading: "Haki zako", body: ["Unaweza kuona na kubadilisha taarifa za akaunti na anwani zako wakati wowote. Kuomba nakala ya taarifa zako au kufuta akaunti, wasiliana nasi."] },
      { heading: "Watoto", body: ["Akaunti ni kwa ajili ya watu wazima. Hatukusanyi taarifa za watoto kwa kujua."] },
      { heading: "Wasiliana nasi", body: ["Maswali kuhusu sera hii yanaweza kutumwa kwa timu yetu ya msaada."] },
      ],
    },
    terms: {
      title: "Sheria na masharti",
      updated: "Ilisasishwa Agosti 2026",
      intro: "Masharti haya yanahusu matumizi yako ya 2KONECT. Kwa kutumia soko unayakubali.",
      sections: [
      { heading: "Kuhusu soko", body: ["2KONECT ni soko lenye njia mbili za kununua. Bidhaa nyingine zipo Tanzania tayari na husafirishwa na muuzaji anayezishikilia. Nyingine hutafutwa kutoka nje ya nchi, huingizwa na 2KONECT na kuletwa kwako. Kila tangazo huonyesha ni ipi, pamoja na muda wa kufika."] },
      { heading: "Akaunti yako", body: ["Una wajibu wa kulinda nenosiri lako na shughuli zote za akaunti yako. Toa taarifa sahihi za mawasiliano na anwani — oda hushindikana zaidi kwa sababu ya namba au anwani isiyo sahihi."] },
      { heading: "Oda", body: ["Kuweka oda ni ombi la kununua. Oda huthibitishwa muuzaji anapoikubali. Bidhaa ikikosekana, oda hughairiwa na hisa iliyotengwa hurudishwa."] },
      { heading: "Bei", body: ["Bei hupangwa na wauzaji na huonyeshwa kwa shilingi za Tanzania. Bei na upatikanaji vinaweza kubadilika wakati wowote kabla oda haijathibitishwa."] },
      { heading: "Malipo", body: ["Jinsi unavyolipa hutegemea unachonunua. Kitu kilichopo tayari Tanzania unaweza kulipa unapopokea — unamlipa dereva kinapofika. Kitu tunachoagiza kutoka nje hulipwa kabla hatujakinunua, kwa Lipa Namba au pesa ya simu, na uwasilishaji wa oda hizo hupangwa tofauti mara bidhaa itakapofika."] },
      { heading: "Usafirishaji", body: ["Tunapeleka Dar es Salaam na mikoa mingine yenye njia ya usafirishaji. Muda wa kufika ni makadirio na hutegemea muuzaji, njia na hali ya siku."] },
      { heading: "Kughairi, kurudisha na marejesho", body: ["Unaweza kughairi oda kupitia akaunti yako ikiwa bado inasubiri au inaandaliwa. Baada ya kupokea, wasiliana na msaada kuhusu kurudisha; ona ukurasa wa kurudisha kwa masharti na muda."] },
      { heading: "Wauzaji", body: ["Wauzaji wana wajibu wa matangazo yao, hisa, bei na hali ya bidhaa wanazotuma. Maduka hukaguliwa kabla ya kuanza, na tunaweza kusimamisha duka linalodanganya au linaloshindwa kutimiza oda."] },
      { heading: "Matumizi yaliyokatazwa", body: ["Huruhusiwi kutumia soko kuuza bidhaa haramu au bandia, kudhalilisha watumiaji au wauzaji, kuharibu huduma, au kukusanya taarifa kiotomatiki bila ruhusa."] },
      { heading: "Kufunga akaunti", body: ["Unaweza kufunga akaunti yako wakati wowote. Tunaweza kusimamisha au kufunga akaunti inayokiuka masharti haya."] },
      { heading: "Wasiliana nasi", body: ["Maswali kuhusu masharti haya yanaweza kutumwa kwa timu yetu ya msaada."] },
      ],
    },
    cookies: {
      title: "Sera ya vidakuzi",
      updated: "Ilisasishwa Agosti 2026",
      intro: "2KONECT huhifadhi taarifa kidogo katika kivinjari chako ili tovuti ikukumbuke kati ya matembezi.",
      sections: [
      { heading: "Tunachohifadhi", body: ["Tunahifadhi haya katika hifadhi ya kivinjari chako, si katika vidakuzi vya kufuatilia."], points: ["Lugha uliyochagua.", "Eneo lako la usafirishaji.", "Kikapu chako, ili kisipotee unapoburudisha ukurasa.", "Kipindi chako cha kuingia, ili usiulizwe kuingia kila ukurasa."] },
      { heading: "Tusichofanya", body: ["Hatutumii vidakuzi vya matangazo wala kufuatilia tovuti nyingine, na hatuuzi taarifa za utembeaji."] },
      { heading: "Kuvidhibiti", body: ["Unaweza kufuta haya wakati wowote kupitia mipangilio ya tovuti kwenye kivinjari. Ukifanya hivyo utatolewa na kikapu kitakuwa tupu, na tovuti itakuuliza lugha tena."] },
      { heading: "Mabadiliko", body: ["Tukiongeza uchambuzi au matangazo baadaye, ukurasa huu utasasishwa kabla haujaanza kutumika."] },
      ],
    },
    delivery: {
      title: "Taarifa za usafirishaji",
      intro: "Jinsi oda yako inavyokufikia — ikianzia Dar es Salaam au ng\u2019ambo.",
      sections: [
      { heading: "Tunapopeleka", body: ["Tunapeleka Dar es Salaam na mikoa mingine ya Tanzania yenye njia ya usafirishaji. Unachagua eneo lako kwenye ramani unapohifadhi anwani, ili dereva ajue mahali sahihi."] },
      { heading: "Muda wa kufika", body: ["Oda za Dar es Salaam mara nyingi hufika ndani ya siku moja hadi mbili za kazi. Mikoa mingine hutegemea njia ya usafirishaji. Nyakati hizi ni makadirio, si ahadi."] },
      { heading: "Gharama ya usafirishaji", body: ["Gharama huonyeshwa wakati wa malipo kabla hujaweka oda, hivyo hakuna mshangao ikifika."] },
      { heading: "Kufuatilia oda yako", body: ["Hali ya oda yako iko kwenye ukurasa wa oda ndani ya akaunti yako: inasubiri, inaandaliwa, imesafirishwa, kisha imekamilika."] },
      { heading: "Dereva anapofika", body: ["Weka namba ya simu ya oda yako ikipatikana — dereva hupiga akiwa karibu. Kwa kulipa ukipokea, mlipe dereva kiasi kilichoonyeshwa."] },
      ],
    },
    returns: {
      title: "Kurudisha na marejesho",
      intro: "Cha kufanya bidhaa ikifika ikiwa imeharibika, ina kasoro au si kama ilivyoelezwa.",
      sections: [
      { heading: "Kabla haijasafirishwa", body: ["Oda ikiwa bado inasubiri au inaandaliwa unaweza kuighairi mwenyewe kupitia ukurasa wa oda. Bidhaa hurudi stoo moja kwa moja."] },
      { heading: "Baada ya kupokea", body: ["Bidhaa ikiwa imeharibika, ina kasoro au si iliyotangazwa, wasiliana na msaada ndani ya siku saba tangu kupokea. Hifadhi bidhaa na kifungashio chake, na tuma picha — hutatua kesi nyingi haraka."] },
      { heading: "Zinazoweza kurudishwa", body: ["Bidhaa ziwe hazijatumika na ziwe kwenye kifungashio chake cha awali, isipokuwa kasoro ndiyo sababu ya kurudisha."], points: ["Iliyoharibika au yenye kasoro ilipofika.", "Bidhaa isiyo sahihi au saizi isiyo sahihi.", "Tofauti kubwa na ilivyotangazwa."] },
      { heading: "Zisizoweza kurudishwa", body: ["Kwa sababu za usafi na usalama, baadhi ya bidhaa haziwezi kurudishwa zikishafunguliwa."], points: ["Vipodozi na bidhaa za mwili muhuri ukishavunjwa.", "Nguo za ndani na za kuogelea.", "Bidhaa zinazoharibika haraka."] },
      { heading: "Marejesho", body: ["Oda za kulipa ukipokea hurejeshwa kwa fedha taslimu bidhaa iliyorudishwa ikifika kwa muuzaji na kukaguliwa. Tutakujulisha matokeo muuzaji akithibitisha."] },
      ],
    },
    contact: {
      title: "Wasiliana nasi",
      intro: "Ongea na mtu kuhusu oda, usafirishaji au akaunti yako.",
      sections: [
      { heading: "Msaada kwa wateja", body: ["Tutumie barua pepe au tupigie ukiwa na kumbukumbu ya oda yako — huanza na 2K — ili tuipate haraka."] },
      { heading: "Kuuza na 2KONECT", body: ["Kama wewe ni muuzaji au unataka kuwa, ukurasa wetu wa msaada kwa wauzaji unaeleza maombi, uidhinishaji na kusimamia duka."] },
      { heading: "Muda wa kujibu", body: ["Tunajibu wakati wa kazi, Jumatatu hadi Jumamosi. Ujumbe wa jioni hujibiwa asubuhi ya siku inayofuata ya kazi."] },
      { heading: "Tulipo", body: ["2KONECT ipo Dar es Salaam, Tanzania."] },
      ],
    },
    about: {
      title: "Sisi ni nani",
      intro: "2KONECT hukuunganisha na unachohitaji — kikiwa tayari hapa nchini, au ng\u2019ambo ya bahari.",
      sections: [
      { heading: "Tunachofanya", body: ["Vitu vingi vinavyouzwa Tanzania huingizwa kutoka nje. Kwa 2KONECT unaweza kununua kilichopo nchini na kukipata ndani ya siku chache, au kuagiza kile kile kutoka ng\u2019ambo kwa bei nafuu zaidi na kufuatilia safari yake hadi mlangoni kwako."] },
      { heading: "Jinsi inavyofanya kazi", body: ["Wauzaji hutangaza hisa halisi. Wewe unavinjari, unaagiza na unalipa ukipokea. Sisi tunashughulikia dereva na msaada kwa wateja."] },
      { heading: "Wauzaji wetu", body: ["Kila duka hukaguliwa na msimamizi kabla bidhaa zake hazijaonekana. Maduka yaliyoidhinishwa hubeba alama ya uthibitisho."] },
      { heading: "Tunapopeleka", body: ["Dar es Salaam kwanza, na mikoa mingine ya Tanzania yenye njia ya usafirishaji."] },
      ],
    },
    guidelines: {
      title: "Miongozo ya wauzaji",
      intro: "Tunachotarajia kutoka kwa maduka yanayouza kwenye 2KONECT.",
      sections: [
      { heading: "Kutangaza bidhaa zako", body: ["Tangaza hisa uliyo nayo na unayoweza kutuma. Tumia picha zako mwenyewe zilizo wazi za bidhaa halisi, na ieleze kwa usahihi — saizi, rangi, hali na kinachojumuishwa."] },
      { heading: "Bei", body: ["Weka bei kwa shilingi za Tanzania, ikijumuisha gharama unazotarajia mnunuzi alipe. Usipandishe bei ili kutangaza punguzo."] },
      { heading: "Kuweka hisa sahihi", body: ["Sasisha hisa inapouzwa kwingine. Oda zinazoghairiwa kwa sababu ya hisa isiyokuwepo ndiyo njia ya haraka ya kupoteza mteja, na kughairi mara kwa mara kunahatarisha duka lako."] },
      { heading: "Kutimiza oda", body: ["Thibitisha na uandae oda haraka, na weka alama kila hatua ya maandalizi na usafirishaji, ili mnunuzi aweze kufuatilia."] },
      { heading: "Yasiyoruhusiwa", points: ["Bidhaa bandia au zilizoingizwa kinyume cha sheria.", "Bidhaa zisizo salama, zilizoisha muda au zilizoondolewa sokoni.", "Picha, vichwa au maelezo yanayopotosha.", "Kupokea malipo au kuwahamisha wanunuzi nje ya jukwaa."] },
      { heading: "Uidhinishaji na kusimamishwa", body: ["Maduka mapya hukaguliwa kabla ya kuanza. Maduka yanayopotosha wanunuzi au yanayoshindwa kutimiza oda yanaweza kusimamishwa."] },
      ],
    },
    sellersupport: {
      title: "Msaada kwa wauzaji",
      intro: "Msaada kwa maduka yanayouza kwenye 2KONECT.",
      sections: [
      { heading: "Kuomba kuuza", body: ["Omba kupitia ukurasa wa kuuza. Utahitaji jina la biashara au duka, taarifa zako za mawasiliano na namba yako ya NIDA kwa uthibitisho. Msimamizi hukagua kila ombi."] },
      { heading: "Ukiwa unasubiri uidhinishaji", body: ["Unaweza kuingia na kuanza kuongeza bidhaa mara akaunti yako inapokuwepo. Zitaonekana mara duka lako litakapoidhinishwa."] },
      { heading: "Kusimamia duka lako", body: ["Dashibodi yako inaonyesha oda, mapato, idadi iliyouzwa na bidhaa zinazokaribia kuisha. Ongeza na hariri bidhaa kupitia skrini ya bidhaa."] },
      { heading: "Oda na malipo", body: ["Sogeza kila oda kupitia maandalizi na usafirishaji unapoishughulikia. Mapato hufuatiliwa kwenye dashibodi kwa oda zilizokamilika."] },
      { heading: "Kupata msaada", body: ["Wasiliana na timu yetu ukiwa na jina la duka lako na, inapohusika, kumbukumbu ya oda."] },
      ],
    },
    help: {
      title: "Kituo cha msaada",
      intro: "Pata jibu, au ongea na timu yetu ya msaada.",
      topics: [
        { name: "Oda", description: "Kuweka, kufuatilia na kughairi oda.", href: "/account/orders" },
        { name: "Usafirishaji", description: "Tunapopeleka, muda na gharama.", href: "/help/delivery" },
        { name: "Kurudisha na marejesho", description: "Bidhaa zilizoharibika au zisizo sahihi.", href: "/help/returns" },
        { name: "Malipo", description: "Kulipa ukipokea, na kinachokuja.", href: "/legal/terms" },
        { name: "Akaunti yako", description: "Kuingia, anwani na taarifa binafsi.", href: "/account" },
        { name: "Kuuza na 2KONECT", description: "Kuomba, uidhinishaji na kusimamia duka.", href: "/sell/support" },
        { name: "Wasiliana na msaada", description: "Ongea na mtu kuhusu oda yako.", href: "/help/contact" },
      ],
      sections: [
      ],
    },
    vendors: {
      title: "Wauzaji wetu",
      intro: "Maduka yaliyoidhinishwa yanayouza kwenye 2KONECT. Kila moja hukaguliwa kabla bidhaa zake hazijaonekana.",
      empty: "Bado hakuna wauzaji wa kuonyesha.",
      productsLabel: "bidhaa",
      sinceLabel: "Anauza tangu {year}",
      sections: [
      ],
    },
};

export const frPages: Record<PageKey, PageCopy> = {
    privacy: {
      title: "Politique de confidentialité",
      updated: "Mise à jour en août 2026",
      intro: "Cette politique explique ce que 2KONECT collecte lorsque vous utilisez la marketplace, pourquoi, et les choix dont vous disposez.",
      sections: [
      { heading: "Informations collectées", body: ["Nous collectons les informations que vous fournissez lors de la création d'un compte, d'une commande ou d'un contact avec le support."], points: ["Vos nom, adresse e-mail et numéro de téléphone.", "Les adresses de livraison enregistrées, y compris un point sur la carte si vous en choisissez un.", "Vos commandes et leur statut de livraison.", "Les messages envoyés aux vendeurs ou à notre équipe."] },
      { heading: "Utilisation de vos informations", body: ["Nous les utilisons pour faire fonctionner la marketplace et vous livrer."], points: ["Traiter et livrer vos commandes.", "Transmettre au vendeur et au livreur ce qui est nécessaire à la livraison.", "Répondre à vos demandes d'assistance.", "Sécuriser les comptes et les paiements."] },
      { heading: "Vendeurs", body: ["2KONECT est une marketplace. Lors d'un achat, le vendeur reçoit ce qu'il lui faut pour préparer et livrer votre commande — nom, téléphone et adresse. Il ne peut pas s'en servir à d'autres fins."] },
      { heading: "Paiements", body: ["Le paiement à la livraison se fait directement entre vous et le livreur. Nous ne conservons aucune donnée bancaire. Lorsque le mobile money sera disponible, le prestataire traitera le paiement et nous n'en recevrons que la confirmation."] },
      { heading: "Cookies et stockage local", body: ["Nous conservons votre langue, votre lieu de livraison, votre panier et votre session dans votre navigateur afin que le site fonctionne d'une visite à l'autre. Voir notre politique de cookies."] },
      { heading: "Partage", body: ["Nous partageons vos informations uniquement lorsque c'est nécessaire à votre commande ou exigé par la loi. Nous ne vendons pas vos données personnelles."] },
      { heading: "Sécurité", body: ["Les mots de passe sont stockés hachés et l'accès aux données clients est réservé au personnel qui en a besoin. Aucun système n'est parfaitement sûr : utilisez un mot de passe solide et unique."] },
      { heading: "Vos droits", body: ["Vous pouvez consulter et modifier vos informations et vos adresses à tout moment depuis votre compte. Pour obtenir une copie de vos données ou supprimer votre compte, contactez-nous."] },
      { heading: "Enfants", body: ["Les comptes sont destinés aux adultes. Nous ne collectons pas sciemment de données concernant des enfants."] },
      { heading: "Contact", body: ["Toute question sur cette politique peut être adressée à notre équipe d'assistance."] },
      ],
    },
    terms: {
      title: "Conditions générales",
      updated: "Mise à jour en août 2026",
      intro: "Ces conditions régissent votre utilisation de 2KONECT. En utilisant la marketplace, vous les acceptez.",
      sections: [
      { heading: "À propos de la marketplace", body: ["2KONECT est une marketplace avec deux façons d\u2019acheter. Certains produits sont déjà en Tanzanie et sont expédiés par le vendeur qui les détient. D\u2019autres sont sourcés à l\u2019étranger, importés par 2KONECT et livrés chez vous. Chaque annonce précise laquelle, avec le délai correspondant."] },
      { heading: "Votre compte", body: ["Vous êtes responsable de la confidentialité de votre mot de passe et de l'activité de votre compte. Indiquez des coordonnées exactes : la plupart des échecs de livraison viennent d'un numéro ou d'une adresse erronés."] },
      { heading: "Commandes", body: ["Passer commande constitue une offre d'achat. La commande est confirmée lorsque le vendeur l'accepte. Si un article s'avère indisponible, la commande est annulée et le stock réservé est libéré."] },
      { heading: "Prix", body: ["Les prix sont fixés par les vendeurs et affichés en shillings tanzaniens. Prix et disponibilité peuvent changer à tout moment avant confirmation."] },
      { heading: "Paiement", body: ["Le mode de paiement dépend de ce que vous achetez. Ce qui est déjà en Tanzanie peut être payé à la livraison — vous réglez le livreur à l'arrivée. Ce que nous commandons à l'étranger est payé avant que nous l'achetions, via Lipa Namba ou mobile money, et la livraison de ces commandes est organisée séparément une fois la marchandise arrivée."] },
      { heading: "Livraison", body: ["Nous livrons à Dar es Salaam et dans les régions desservies par une tournée. Les délais sont indicatifs et dépendent du vendeur, de la tournée et des conditions du jour."] },
      { heading: "Annulations, retours et remboursements", body: ["Vous pouvez annuler une commande depuis votre compte tant qu'elle est en attente ou en préparation. Après livraison, contactez le support ; voir notre page des retours pour les conditions et les délais."] },
      { heading: "Vendeurs", body: ["Les vendeurs sont responsables de leurs annonces, de leur stock, de leurs prix et de l'état de ce qu'ils expédient. Les boutiques sont validées avant mise en ligne et peuvent être suspendues en cas de tromperie ou de commandes non honorées."] },
      { heading: "Usages interdits", body: ["Il est interdit d'utiliser la marketplace pour vendre des produits illégaux ou contrefaits, pour harceler d'autres utilisateurs ou vendeurs, pour perturber le service, ou pour en extraire des données automatiquement sans autorisation."] },
      { heading: "Fermeture d'un compte", body: ["Vous pouvez fermer votre compte à tout moment. Nous pouvons suspendre ou fermer un compte qui enfreint ces conditions."] },
      { heading: "Contact", body: ["Toute question sur ces conditions peut être adressée à notre équipe d'assistance."] },
      ],
    },
    cookies: {
      title: "Politique de cookies",
      updated: "Mise à jour en août 2026",
      intro: "2KONECT conserve une petite quantité d'informations dans votre navigateur pour se souvenir de vous d'une visite à l'autre.",
      sections: [
      { heading: "Ce que nous conservons", body: ["Ces éléments sont conservés dans le stockage local de votre navigateur, et non dans des cookies de pistage."], points: ["La langue choisie.", "Votre lieu de livraison.", "Votre panier, pour qu'il survive à un rafraîchissement.", "Votre session, pour ne pas devoir vous reconnecter à chaque page."] },
      { heading: "Ce que nous ne faisons pas", body: ["Nous n'utilisons ni cookies publicitaires ni pistage inter-sites, et nous ne vendons pas de données de navigation."] },
      { heading: "Comment les gérer", body: ["Vous pouvez tout effacer depuis les paramètres de site de votre navigateur. Cela vous déconnecte, vide votre panier, et le site vous redemandera votre langue."] },
      { heading: "Modifications", body: ["Si nous ajoutons de l'analytique ou de la publicité, cette page sera mise à jour avant leur mise en service."] },
      ],
    },
    delivery: {
      title: "Informations de livraison",
      intro: "Comment votre commande vous parvient — qu\u2019elle parte de Dar es Salaam ou de l\u2019autre bout du monde.",
      sections: [
      { heading: "Où nous livrons", body: ["Nous livrons à Dar es Salaam et dans les autres régions de Tanzanie desservies par une tournée. Vous choisissez votre point de livraison sur une carte, pour que le livreur sache exactement où aller."] },
      { heading: "Délais", body: ["Les commandes à Dar es Salaam arrivent généralement sous un à deux jours ouvrés. Les autres régions dépendent de la tournée. Ces délais sont indicatifs."] },
      { heading: "Frais de livraison", body: ["Les frais sont affichés au moment du paiement, avant validation : aucune surprise à l'arrivée."] },
      { heading: "Suivre votre commande", body: ["Le statut se trouve dans vos commandes : en attente, en préparation, expédiée, puis terminée."] },
      { heading: "À l'arrivée du livreur", body: ["Restez joignable au numéro indiqué sur la commande : le livreur appelle en approchant. En paiement à la livraison, réglez le montant affiché sur votre commande."] },
      ],
    },
    returns: {
      title: "Retours et remboursements",
      intro: "Que faire si un article arrive endommagé, défectueux ou non conforme.",
      sections: [
      { heading: "Avant l'expédition", body: ["Tant que la commande est en attente ou en préparation, vous pouvez l'annuler vous-même depuis vos commandes. Les articles retournent immédiatement en stock."] },
      { heading: "Après livraison", body: ["Si un article est endommagé, défectueux ou manifestement différent de l'annonce, contactez le support dans les sept jours suivant la livraison. Conservez l'article et son emballage et envoyez des photos : cela règle la plupart des cas rapidement."] },
      { heading: "Ce qui peut être retourné", body: ["Les articles doivent être inutilisés et dans leur emballage d'origine, sauf si le défaut est le motif du retour."], points: ["Endommagé ou défectueux à l'arrivée.", "Article ou taille incorrects.", "Sensiblement différent de l'annonce."] },
      { heading: "Ce qui ne peut pas être retourné", body: ["Pour des raisons d'hygiène et de sécurité, certains articles ne peuvent pas être repris une fois ouverts."], points: ["Cosmétiques et soins personnels une fois descellés.", "Sous-vêtements et maillots de bain.", "Denrées périssables."] },
      { heading: "Remboursements", body: ["Les commandes payées à la livraison sont remboursées en espèces une fois l'article reçu et vérifié par le vendeur. Nous vous informons dès sa confirmation."] },
      ],
    },
    contact: {
      title: "Nous contacter",
      intro: "Parlez à quelqu'un au sujet d'une commande, d'une livraison ou de votre compte.",
      sections: [
      { heading: "Service client", body: ["Écrivez-nous ou appelez-nous en indiquant la référence de commande — elle commence par 2K — pour que nous la retrouvions immédiatement."] },
      { heading: "Vendre avec 2KONECT", body: ["Si vous êtes vendeur ou souhaitez le devenir, notre page d'assistance vendeurs couvre les candidatures, la validation et la gestion d'une boutique."] },
      { heading: "Délais de réponse", body: ["Nous répondons aux heures ouvrables, du lundi au samedi. Les messages envoyés en fin de journée reçoivent généralement une réponse le lendemain matin."] },
      { heading: "Où nous sommes", body: ["2KONECT est basée à Dar es Salaam, en Tanzanie."] },
      ],
    },
    about: {
      title: "Qui sommes-nous",
      intro: "2KONECT vous relie à ce dont vous avez besoin — que ce soit déjà ici, ou à l\u2019autre bout du monde.",
      sections: [
      { heading: "Ce que nous faisons", body: ["L\u2019essentiel de ce que la Tanzanie achète est importé. Avec 2KONECT, achetez ce qui est déjà dans le pays et recevez-le en quelques jours, ou commandez la même chose depuis l\u2019étranger à un prix plus bas et suivez chaque étape du trajet."] },
      { heading: "Comment ça marche", body: ["Les vendeurs publient leur stock réel. Vous parcourez, commandez et payez à la livraison. Nous gérons le livreur et le service client."] },
      { heading: "Nos vendeurs", body: ["Chaque boutique est validée par un administrateur avant la mise en ligne de ses produits. Les boutiques validées portent un badge vérifié."] },
      { heading: "Où nous livrons", body: ["Dar es Salaam en priorité, puis les autres régions de Tanzanie desservies par une tournée."] },
      ],
    },
    guidelines: {
      title: "Guide du vendeur",
      intro: "Ce que nous attendons des boutiques vendant sur 2KONECT.",
      sections: [
      { heading: "Publier vos produits", body: ["Ne publiez que du stock réellement détenu et expédiable. Utilisez vos propres photos nettes de l'article réel et décrivez-le fidèlement : taille, couleur, état et contenu."] },
      { heading: "Prix", body: ["Fixez vos prix en shillings tanzaniens, frais éventuels compris. Ne gonflez pas un prix pour afficher une remise."] },
      { heading: "Tenir le stock à jour", body: ["Mettez le stock à jour lorsqu'il se vend ailleurs. Les annulations dues à un stock inexistant sont le moyen le plus rapide de perdre un client et mettent votre boutique en danger."] },
      { heading: "Honorer les commandes", body: ["Confirmez et préparez rapidement, et marquez chaque étape de préparation et d'expédition pour que l'acheteur puisse suivre."] },
      { heading: "Ce qui est interdit", points: ["Produits contrefaits ou importés illégalement.", "Produits dangereux, périmés ou rappelés.", "Photos, titres ou descriptions trompeurs.", "Encaisser un paiement ou faire sortir l'acheteur de la plateforme."] },
      { heading: "Validation et suspension", body: ["Les nouvelles boutiques sont examinées avant mise en ligne. Celles qui trompent les acheteurs ou n'honorent pas leurs commandes peuvent être suspendues."] },
      ],
    },
    sellersupport: {
      title: "Assistance vendeurs",
      intro: "Aide destinée aux boutiques vendant sur 2KONECT.",
      sections: [
      { heading: "Devenir vendeur", body: ["Postulez depuis la page de vente. Il vous faudra le nom de votre boutique, vos coordonnées et votre numéro NIDA pour la vérification. Chaque candidature est examinée par un administrateur."] },
      { heading: "En attendant la validation", body: ["Vous pouvez vous connecter et ajouter des produits dès la création du compte. Ils sont mis en ligne dès la validation de votre boutique."] },
      { heading: "Gérer votre boutique", body: ["Votre tableau de bord affiche commandes, revenus, unités vendues et produits bientôt en rupture. Ajoutez et modifiez vos produits depuis l'écran produits."] },
      { heading: "Commandes et versements", body: ["Faites progresser chaque commande au fil de la préparation et de l'expédition. Les revenus sont suivis dans votre tableau de bord sur les commandes terminées."] },
      { heading: "Obtenir de l'aide", body: ["Contactez notre équipe en indiquant le nom de votre boutique et, le cas échéant, la référence de commande."] },
      ],
    },
    help: {
      title: "Centre d'aide",
      intro: "Trouvez une réponse, ou parlez à notre équipe d'assistance.",
      topics: [
        { name: "Commandes", description: "Passer, suivre et annuler une commande.", href: "/account/orders" },
        { name: "Livraison", description: "Où, en combien de temps et à quel prix.", href: "/help/delivery" },
        { name: "Retours et remboursements", description: "Articles endommagés, défectueux ou incorrects.", href: "/help/returns" },
        { name: "Paiements", description: "Paiement à la livraison, et la suite.", href: "/legal/terms" },
        { name: "Votre compte", description: "Connexion, adresses et informations personnelles.", href: "/account" },
        { name: "Vendre avec 2KONECT", description: "Candidature, validation et gestion de boutique.", href: "/sell/support" },
        { name: "Contacter le support", description: "Parlez à quelqu'un de votre commande.", href: "/help/contact" },
      ],
      sections: [
      ],
    },
    vendors: {
      title: "Nos vendeurs",
      intro: "Les boutiques validées présentes sur 2KONECT. Chacune est examinée avant la mise en ligne de ses produits.",
      empty: "Aucun vendeur à afficher pour le moment.",
      productsLabel: "produits",
      sinceLabel: "Vend depuis {year}",
      sections: [
      ],
    },
};

export const zhPages: Record<PageKey, PageCopy> = {
    privacy: {
      title: "隐私政策",
      updated: "最后更新于 2026 年 8 月",
      intro: "本政策说明 2KONECT 在您使用本平台时收集哪些信息、为何收集，以及您可以做出的选择。",
      sections: [
      { heading: "我们收集的信息", body: ["当您注册账户、下单或联系客服时，我们会收集您提供的信息。"], points: ["您的姓名、电子邮箱和手机号码。", "您保存的收货地址，包括您在地图上选择的位置。", "您的订单及其配送状态。", "您发送给卖家或客服团队的消息。"] },
      { heading: "信息的用途", body: ["我们使用这些信息来运营平台并完成配送。"], points: ["处理并配送您的订单。", "向卖家和骑手提供配送所需的信息。", "回复您的客服请求。", "保障账户与支付安全。"] },
      { heading: "卖家", body: ["2KONECT 是一个交易平台。您下单后，卖家会收到备货与配送所需的信息 — 姓名、手机号码和收货地址。卖家不得将其用于其他用途。"] },
      { heading: "支付", body: ["货到付款由您与骑手直接完成。我们不存储银行卡信息。手机支付上线后，将由服务商处理，我们只接收支付结果的确认。"] },
      { heading: "Cookie 与本地存储", body: ["我们将您的语言、收货位置、购物车和登录状态保存在浏览器中，以便您再次访问时网站正常工作。详见我们的 Cookie 政策。"] },
      { heading: "信息共享", body: ["仅在完成订单所必需或法律要求时共享信息。我们不出售您的个人信息。"] },
      { heading: "安全", body: ["密码以哈希形式存储，客户数据仅限必要员工访问。没有系统是绝对安全的，请使用高强度且唯一的密码。"] },
      { heading: "您的权利", body: ["您可以随时在账户中查看和修改个人信息与收货地址。如需获取数据副本或注销账户，请联系我们。"] },
      { heading: "儿童", body: ["账户面向成年人。我们不会在知情的情况下收集儿童信息。"] },
      { heading: "联系我们", body: ["有关本政策的问题可发送给我们的客服团队。"] },
      ],
    },
    terms: {
      title: "条款与条件",
      updated: "最后更新于 2026 年 8 月",
      intro: "本条款适用于您对 2KONECT 的使用。使用本平台即表示您接受这些条款。",
      sections: [
      { heading: "关于本平台", body: ["2KONECT 提供两种购买方式。部分商品已在坦桑尼亚，由持有库存的卖家直接发货；其余商品由 2KONECT 从海外采购、进口并送达。每个商品页都会注明属于哪一种，以及相应的送达时间。"] },
      { heading: "您的账户", body: ["您有责任保管密码并对账户下的活动负责。请填写准确的联系方式与地址 — 订单失败最常见的原因就是号码或地址有误。"] },
      { heading: "订单", body: ["下单即为购买要约。卖家接受后订单方为确认。若商品实际缺货，订单将被取消，预留库存随之释放。"] },
      { heading: "价格", body: ["价格由卖家设定，以坦桑尼亚先令显示。在订单确认前，价格与库存可能随时变动。"] },
      { heading: "支付", body: ["支付方式取决于您购买的商品。已在坦桑尼亚的商品可货到付款——送达时付款给骑手。由我们从海外订购的商品需在采购前付款，使用 Lipa Namba 或手机支付；这类订单的配送在货物抵达后另行安排。"] },
      { heading: "配送", body: ["我们配送至达累斯萨拉姆，以及已开通线路的其他地区。送达时间为预估值，取决于卖家、线路与当日情况。"] },
      { heading: "取消、退货与退款", body: ["订单处于待处理或备货中时，您可在账户内自行取消。送达后如需退货请联系客服；具体条件与时限见退货页面。"] },
      { heading: "卖家", body: ["卖家对其商品信息、库存、价格及所发货物的状况负责。店铺上线前须经审核，若存在虚假描述或未能履约，我们可暂停其经营。"] },
      { heading: "禁止行为", body: ["不得利用本平台销售非法或仿冒商品、骚扰其他用户或卖家、干扰服务运行，或未经许可自动抓取平台数据。"] },
      { heading: "账户终止", body: ["您可随时注销账户。对于违反本条款的账户，我们可予以暂停或关闭。"] },
      { heading: "联系我们", body: ["有关本条款的问题可发送给我们的客服团队。"] },
      ],
    },
    cookies: {
      title: "Cookie 政策",
      updated: "最后更新于 2026 年 8 月",
      intro: "2KONECT 会在您的浏览器中保存少量信息，以便再次访问时记住您。",
      sections: [
      { heading: "我们保存的内容", body: ["这些内容保存在浏览器的本地存储中，而非追踪型 Cookie。"], points: ["您选择的语言。", "您的收货位置。", "您的购物车，刷新后不会丢失。", "您的登录状态，无需在每个页面重新登录。"] },
      { heading: "我们不做的事", body: ["我们不使用广告或跨站追踪 Cookie，也不出售浏览数据。"] },
      { heading: "如何管理", body: ["您可随时在浏览器的网站设置中清除这些数据。清除后将退出登录、清空购物车，网站也会再次询问您的语言。"] },
      { heading: "政策变更", body: ["若日后接入统计分析或广告，本页面将在其上线前更新。"] },
      ],
    },
    delivery: {
      title: "配送说明",
      intro: "您的订单如何送达 —— 无论它从达累斯萨拉姆出发，还是从地球另一端。",
      sections: [
      { heading: "配送范围", body: ["我们配送至达累斯萨拉姆，以及坦桑尼亚其他已开通线路的地区。保存地址时您可在地图上选择收货点，骑手即可准确找到位置。"] },
      { heading: "配送时长", body: ["达累斯萨拉姆的订单通常在一至两个工作日内送达。其他地区取决于线路。以上均为预估时间，并非承诺。"] },
      { heading: "配送费", body: ["配送费在您提交订单前的结算页面显示，送达时不会有额外费用。"] },
      { heading: "查询订单", body: ["订单状态显示在账户的订单页面：待处理、备货中、已发货、已完成。"] },
      { heading: "骑手送达时", body: ["请保持订单上的手机号码畅通 — 骑手临近时会来电。货到付款时，请按订单显示金额付款给骑手。"] },
      ],
    },
    returns: {
      title: "退货与退款",
      intro: "商品破损、有瑕疵或与描述不符时该怎么办。",
      sections: [
      { heading: "发货前", body: ["订单仍处于待处理或备货中时，您可在订单页面自行取消，商品会立即退回库存。"] },
      { heading: "送达后", body: ["若商品破损、存在瑕疵或明显与描述不符，请在送达后七天内联系客服。请保留商品及其包装并拍照发送 — 多数情况可据此快速处理。"] },
      { heading: "可以退货的情形", body: ["商品须未使用且保持原包装，因质量问题退货的除外。"], points: ["送达时已破损或存在瑕疵。", "发错商品或尺码。", "与商品描述存在实质差异。"] },
      { heading: "不可退货的情形", body: ["出于卫生与安全考虑，部分商品拆封后不可退货。"], points: ["已拆封的化妆品与个人护理用品。", "内衣与泳装。", "易腐商品。"] },
      { heading: "退款", body: ["货到付款订单在退回商品送达卖家并完成检验后以现金退款。卖家确认后我们会第一时间告知结果。"] },
      ],
    },
    contact: {
      title: "联系我们",
      intro: "就订单、配送或账户问题与我们的人员沟通。",
      sections: [
      { heading: "客户支持", body: ["请发送邮件或致电，并附上以 2K 开头的订单编号，以便我们立即查询。"] },
      { heading: "入驻 2KONECT", body: ["若您是卖家或希望入驻，我们的卖家支持页面介绍了申请、审核与店铺管理。"] },
      { heading: "回复时间", body: ["我们在周一至周六的工作时间回复。当日较晚发送的消息通常在下一个工作日上午回复。"] },
      { heading: "我们的位置", body: ["2KONECT 位于坦桑尼亚达累斯萨拉姆。"] },
      ],
    },
    about: {
      title: "关于我们",
      intro: "2KONECT 帮您找到所需之物 —— 无论它已在本地，还是远在海外。",
      sections: [
      { heading: "我们做什么", body: ["坦桑尼亚销售的大部分商品来自进口。在 2KONECT，您可以购买已在国内的现货，几天内送达；也可以从海外下单同一件商品，价格更低，并全程追踪它的旅程。"] },
      { heading: "运作方式", body: ["卖家上架真实库存。您浏览、下单并在送达时付款。骑手配送与客户支持由我们负责。"] },
      { heading: "我们的卖家", body: ["每家店铺的商品上线前都会经管理员审核。通过审核的店铺会在商品上显示认证标识。"] },
      { heading: "配送范围", body: ["优先覆盖达累斯萨拉姆，以及坦桑尼亚其他已开通线路的地区。"] },
      ],
    },
    guidelines: {
      title: "卖家指南",
      intro: "我们对在 2KONECT 经营的店铺的要求。",
      sections: [
      { heading: "发布商品", body: ["只发布您实际持有且能够发货的库存。请使用您自己拍摄的清晰实物照片，并如实描述尺码、颜色、成色及包含内容。"] },
      { heading: "定价", body: ["请以坦桑尼亚先令定价，并包含您希望买家承担的费用。不得先抬高价格再宣传折扣。"] },
      { heading: "保持库存准确", body: ["商品在其他渠道售出后请及时更新库存。因库存不实导致的取消是流失客户最快的方式，反复取消将危及您的店铺。"] },
      { heading: "履行订单", body: ["请及时确认并备货，并在备货与发货的每个环节更新状态，方便买家跟踪。"] },
      { heading: "禁止事项", points: ["仿冒或非法进口商品。", "不安全、过期或已召回的商品。", "具有误导性的图片、标题或描述。", "收取平台外付款或引导买家离开平台。"] },
      { heading: "审核与暂停", body: ["新店铺上线前须经审核。误导买家或未能履约的店铺可能被暂停经营。"] },
      ],
    },
    sellersupport: {
      title: "卖家支持",
      intro: "面向在 2KONECT 经营的店铺的帮助。",
      sections: [
      { heading: "申请入驻", body: ["请从开店页面提交申请。您需要提供企业或店铺名称、联系方式，以及用于身份核验的 NIDA 号码。每份申请都由管理员审核。"] },
      { heading: "等待审核期间", body: ["账户创建后即可登录并开始添加商品，店铺通过审核后立即上线。"] },
      { heading: "管理店铺", body: ["卖家中心显示订单、收入、销量以及库存偏低的商品。您可在商品页面添加和编辑商品。"] },
      { heading: "订单与结算", body: ["请随处理进度推进每个订单的备货与发货状态。收入按已完成订单在卖家中心统计。"] },
      { heading: "获取帮助", body: ["联系我们时请提供店铺名称，如有需要请附上订单编号。"] },
      ],
    },
    help: {
      title: "帮助中心",
      intro: "查找答案，或联系我们的客服团队。",
      topics: [
        { name: "订单", description: "下单、查询与取消订单。", href: "/account/orders" },
        { name: "配送", description: "配送范围、时长与费用。", href: "/help/delivery" },
        { name: "退货与退款", description: "破损、瑕疵或错发商品。", href: "/help/returns" },
        { name: "支付", description: "货到付款，以及即将推出的方式。", href: "/legal/terms" },
        { name: "您的账户", description: "登录、地址与个人信息。", href: "/account" },
        { name: "入驻 2KONECT", description: "申请、审核与店铺管理。", href: "/sell/support" },
        { name: "联系客服", description: "就您的订单与我们沟通。", href: "/help/contact" },
      ],
      sections: [
      ],
    },
    vendors: {
      title: "入驻卖家",
      intro: "在 2KONECT 经营的已认证店铺。每家店铺的商品上线前都经过审核。",
      empty: "暂无可显示的卖家。",
      productsLabel: "件商品",
      sinceLabel: "自 {year} 年开店",
      sections: [
      ],
    },
};

export const PAGE_CONTENT = { en: enPages, sw: swPages, fr: frPages, zh: zhPages };
