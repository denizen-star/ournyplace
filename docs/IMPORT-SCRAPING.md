# Future Import and Scraping

Manual entry is the source of truth for v1. Every apartment stores `listing_url`, `source_url`, and `import_status` so an importer can be added without changing the core decision workflow.

## Current Paste Helper

The Notes field already parses pasted listing text. It does not fetch remote pages.

It recognizes (see `lib/listingTextParse.js` / `assets/js/listingTextParse.js`):

- `Rental unit in <Neighborhood>` -> Neighborhood
- Google Maps-style comma line starting with street number, e.g. `250 Ashland Pl, Brooklyn, NY 11217, United States` -> Address (+ neighborhood segment before state/zip when present)
- Top line only `#39M` (or similar) -> Apt; often paired with a following address line
- `250 Ashland Place #39M` (street + `#` unit on one line) -> Address + Apt
- `<Address> #<Apt>` (other layouts) -> Address and Apt number
- `$x` with next line `For Rent` -> Rent (if amount ≥ 400 and rent not yet set; same pass as `base rent`)
- `$x` followed by `base rent` -> Rent
- `$x net effective base rent` -> Net effective
- Small standalone fee lines, e.g. `$150` -> Amenities fees
- `<n> bed`, `<n> bath`, `<n> ft²`
- `New Development` -> New construction amenity
- `Listing by ...`, lease concessions, and remaining unmapped lines -> organized Notes
- Plain `https://...` lines -> Listing URL

Later import should be additive:

- Paste a listing URL.
- Fetch or scrape basic fields into a review screen.
- Let a person confirm the title, rent, photos, fees, and notes before saving.
- Store the original URL in `source_url` and mark `import_status` as `imported` or `needs_review`.

Do not let scraping overwrite manually edited apartment data without an explicit review step.
