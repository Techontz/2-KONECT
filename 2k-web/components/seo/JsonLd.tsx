/**
 * A single JSON-LD block.
 *
 * A server component on purpose: structured data belongs in the HTML Google
 * receives, not in something injected after hydration. Rendering it here also
 * keeps it out of the client bundle entirely.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;

  return (
    <script
      type="application/ld+json"
      // The payload is built from our own API's values, never from user input
      // rendered as markup. `</script>` inside a string would still break out
      // of the tag, so it is escaped rather than trusted.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export default JsonLd;
