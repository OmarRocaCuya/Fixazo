# Local font assets

These are the unmodified Latin WOFF2 assets previously downloaded by
`next/font/google` for this application's existing typography. The family,
weight and file mapping was verified against the generated `@font-face` rules
in `.next/dev/static/chunks/*internal_font_google*.css` before copying them.
The app now self-hosts them with `next/font/local`: builds and page loads do
not need Google Fonts. Latin covers the Spanish and Quechua text in the MVP;
other writing systems use the configured system fallback.

| Local file | Family / weight | Original cached file | SHA-256 |
| --- | --- | --- | --- |
| `bricolage-grotesque-latin-variable.woff2` | Bricolage Grotesque, variable 700–800 | `017d9bea37084d9b-s.p.41rroleoq1br7.woff2` | `4fd48b2c1ab27220e71f15f990550261b35245c3bdfd8d8025b4bdac0459ee2d` |
| `atkinson-hyperlegible-latin-400.woff2` | Atkinson Hyperlegible, 400 | `ed5f1f9bced69653-s.p.2li_3lqay9qjq.woff2` | `a60206dd4793eb886952e48dc3e1c1d59942c004b2ab1e0086e7ccd156a7852d` |
| `atkinson-hyperlegible-latin-700.woff2` | Atkinson Hyperlegible, 700 | `89ea96820aa96980-s.p.0hs6q6udzld4a.woff2` | `1cc7c0c5fbf16d1be3cb6d95c89fc0afd0e11f264e239ac97c64a326c5d88fe4` |
| `ibm-plex-mono-latin-500.woff2` | IBM Plex Mono, 500 | `effe91970fc4db64-s.p.0oace-s_gkfks.woff2` | `a76f53ca6612e7b3828eec2311098675b7f9849ae4169a8bcef6302aec02a6c0` |

The original SIL Open Font License 1.1 notices are included alongside the
assets. Sources (retrieved 2026-10-17):

- [Atkinson Hyperlegible — Google Fonts](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegible)
- [Bricolage Grotesque — Google Fonts](https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque)
- [IBM Plex Mono — Google Fonts](https://github.com/google/fonts/tree/main/ofl/ibmplexmono)

`../reset.css` separately preserves the former Tailwind CSS 4.3.3 preflight
without its compiler or utility framework. Its original MIT notice is in
`../licenses/tailwind-MIT.txt`.
