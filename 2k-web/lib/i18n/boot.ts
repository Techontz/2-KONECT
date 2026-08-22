import { DEFAULT_LANGUAGE, LANGUAGES } from "./types";

/**
 * The pre-hydration language guard.
 *
 * Every page is static HTML written in English, which is the right trade:
 * static pages are what make the storefront fast, cacheable and crawlable, and
 * putting the language in a cookie so the server could read it would turn
 * every route dynamic and undo all three.
 *
 * The cost of that trade is a flash. The browser paints the English HTML at
 * ~20ms, React hydrates, and only then does the stored preference apply —
 * measured at 61ms on a fast machine and 239ms with the CPU throttled 4×, and
 * worse on the low-end Android this marketplace is mostly used from. A
 * returning Kiswahili shopper watched the site load in the wrong language
 * every single time.
 *
 * This closes that window without touching how anything renders. The script is
 * inline and synchronous, so it runs before the first paint: it reads the one
 * key the language switcher writes and, *only* if a non-English language is
 * stored, marks the document. A stylesheet rule then holds the body invisible —
 * `visibility`, not `display`, so the layout is still computed and the brand
 * background still paints — until React has applied the language and cleared
 * the mark.
 *
 * What it deliberately does not do:
 *
 *   - Nothing happens for English, and nothing happens for a first-time
 *     visitor, which is almost all traffic and all crawlers. No stored
 *     preference means no attribute, no rule, no delay.
 *   - It cannot leave the page blank. The mark clears itself after 800ms
 *     whatever happens, so a JavaScript failure, a blocked bundle or a
 *     hydration error can never hide the site.
 *   - It reads; it never writes. The switcher remains the only writer.
 *
 * The attribute carries the stored code rather than being a bare flag, because
 * the release has to be able to tell the two renders apart. React hydrates in
 * English — it must, or the markup would not match — and only re-renders in
 * the stored language a frame later. A guard that cleared on the first commit
 * therefore uncovered the English frame it was there to hide, which is exactly
 * what happened on a throttled CPU. Holding the code lets the release wait for
 * the render that actually matches it.
 *
 * The generated source is tiny and has no dependencies, so it is written as a
 * string rather than compiled — but the language codes come from the same
 * LANGUAGES list the rest of the system uses, so adding a language cannot
 * leave this behind.
 */
const CODES = LANGUAGES.map((language) => language.code);

export const LANGUAGE_BOOT = `(function(){try{
var k=localStorage.getItem("2konect.language");
if(!k||k==="${DEFAULT_LANGUAGE}"||${JSON.stringify(CODES)}.indexOf(k)<0)return;
var d=document.documentElement;d.setAttribute("data-lang-pending",k);d.lang=k;
setTimeout(function(){d.removeAttribute("data-lang-pending")},800);
}catch(e){}})();`;
