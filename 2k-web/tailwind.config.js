/**
 * Tailwind v4 reads the design tokens from the `@theme` block in
 * app/globals.css — that file is the source of truth for colour, radius and
 * shadow. This config only tells the scanner where class names live.
 */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
};
