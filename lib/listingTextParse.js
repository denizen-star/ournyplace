/**
 * Listing paste parsing (StreetEasy, Google Maps lines, unit-first lines).
 * Keep in sync with assets/js/listingTextParse.js.
 */

function buildOrganizedNotes(notes, other) {
  const sections = [];
  const uniqueNotes = Array.from(new Set(notes));
  const uniqueOther = Array.from(new Set(other));
  if (uniqueNotes.length) sections.push(uniqueNotes.join('\n'));
  if (uniqueOther.length) sections.push(`Other:\n${uniqueOther.join('\n')}`);
  return sections.join('\n\n');
}

/** First comma-separated segment is not "3 rooms" / "1 month free" style junk. */
function looksLikeStreetCommaSegment(s) {
  const t = String(s || '').trim();
  if (!/^\d+\s+[A-Za-z]/.test(t)) return false;
  if (/month|bed|bath|ft²|rooms?|lease|free|available|open house|by appt|for rent|^1 of \d+/i.test(t)) return false;
  return true;
}

function isLikelyStateOrZipSegment(s) {
  const t = String(s || '').trim();
  if (/^(United States|USA|US)$/i.test(t)) return true;
  return /^[A-Z]{2}(\s+[\d-]{4,10})?$/i.test(t);
}

/** e.g. "250 Ashland Pl, Brooklyn, NY 11217, United States" */
function tryParseCommaMapsLine(line, parsed, consumed, notes, index) {
  if (!line.includes(',')) return false;
  if (!/^\d/.test(line.trim())) return false;
  const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  if (!looksLikeStreetCommaSegment(parts[0])) return false;

  parsed.address = parts[0];
  const skipGeo = new Set(['united states', 'usa', 'us']);
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (skipGeo.has(p.toLowerCase())) break;
    if (isLikelyStateOrZipSegment(p)) break;
    parsed.neighborhood = p;
    break;
  }
  consumed[index] = true;
  notes.push('Address (from maps-style line)');
  return true;
}

/** "250 Ashland Place #39M" — line must start with a street number. */
function tryParseStreetWithUnit(line, parsed, consumed, index) {
  const m = line.match(/^(\d+[A-Za-z0-9\s,.'-]+?)\s+#\s*([A-Za-z0-9-]+)$/i);
  if (!m) return false;
  const street = m[1].trim().replace(/[,\s]+$/g, '');
  if (!street || !/\d/.test(street)) return false;
  parsed.address = street;
  parsed.aptNumber = m[2] || '';
  consumed[index] = true;
  return true;
}

/** Top line only "#39M" or "#12B" */
function tryParseUnitOnlyLine(line, parsed, consumed, index) {
  const m = line.match(/^#([A-Za-z0-9-]+)$/i);
  if (!m) return false;
  parsed.aptNumber = m[1];
  consumed[index] = true;
  return true;
}

function looksLikeNeighborhoodName(s) {
  const t = String(s || '').trim();
  if (t.length < 2 || t.length > 80) return false;
  if (/^\$|https?:\/\//i.test(t)) return false;
  if (/^\d+(?:\.\d+)?\s*(bed|bath|ft²|rooms?)\b/i.test(t)) return false;
  if (/^[-\d]+\s*ft²$/i.test(t)) return false;
  return /^[A-Za-z]/.test(t) && /^[A-Za-z\s.'-]+$/i.test(t);
}

function parseListingText(text) {
  if (!text || !String(text).trim()) return null;
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = { amenities: [] };
  const notes = [];
  const other = [];
  const consumed = {};

  lines.forEach((line, index) => {
    const neighborhoodInMatch = line.match(/^Rental unit in (.+)$/i);
    if (neighborhoodInMatch) {
      parsed.neighborhood = neighborhoodInMatch[1].trim();
      consumed[index] = true;
      notes.push('Listing type: Rental unit');
      return;
    }

    if (/^Rental unit$/i.test(line)) {
      consumed[index] = true;
      notes.push('Listing type: Rental unit');
      const next = lines[index + 1];
      if (next != null && !consumed[index + 1] && looksLikeNeighborhoodName(next)) {
        parsed.neighborhood = next.trim();
        consumed[index + 1] = true;
      }
      return;
    }

    if (tryParseCommaMapsLine(line, parsed, consumed, notes, index)) return;

    if (tryParseStreetWithUnit(line, parsed, consumed, index)) return;

    if (tryParseUnitOnlyLine(line, parsed, consumed, index)) return;

    if (/^New Development$/i.test(line)) {
      parsed.amenities.push('new-construction');
      consumed[index] = true;
      notes.push('Building: New development');
      return;
    }

    const linkMatch = line.match(/^https?:\/\/\S+$/i);
    if (linkMatch) {
      parsed.listingUrl = line;
      consumed[index] = true;
    }
  });

  for (let i = 0; i < lines.length; i++) {
    if (/^\$[\d,]+$/.test(lines[i])) {
      const amount = Number(lines[i].replace(/[$,]/g, ''));
      const next = lines[i + 1] || '';
      if (/^base rent$/i.test(next) && parsed.rent == null) {
        parsed.rent = amount;
        consumed[i] = true;
        consumed[i + 1] = true;
      } else if (/^For Rent$/i.test(next) && parsed.rent == null && amount >= 400) {
        parsed.rent = amount;
        consumed[i] = true;
        consumed[i + 1] = true;
      } else if (/net effective base rent/i.test(next)) {
        parsed.netEffective = amount;
        consumed[i] = true;
        consumed[i + 1] = true;
      } else if (amount < 1000 && parsed.amenitiesFees == null) {
        parsed.amenitiesFees = amount;
        consumed[i] = true;
        notes.push(`Additional monthly fee: $${amount}`);
      }
    } else {
      const inlineNet = lines[i].match(/^\$([\d,]+)\s+net effective base rent$/i);
      if (inlineNet) {
        parsed.netEffective = Number(inlineNet[1].replace(/,/g, ''));
        consumed[i] = true;
      }
    }
  }

  const sqftMatch = String(text).match(/([\d,]+|-)\s*ft²/i);
  if (sqftMatch && sqftMatch[1] !== '-') parsed.squareFeet = Number(sqftMatch[1].replace(/,/g, ''));

  const bedMatch = String(text).match(/(\d+(?:\.\d+)?)\s*bed\b/i);
  if (bedMatch) parsed.bedrooms = Number(bedMatch[1]);

  const bathMatch = String(text).match(/(\d+(?:\.\d+)?)\s*bath\b/i);
  if (bathMatch) parsed.bathrooms = Number(bathMatch[1]);

  lines.forEach((line, index) => {
    if (consumed[index]) return;
    if (/^Save$/i.test(line) || /^For Rent$/i.test(line)) return;
    if (/^Rental unit$/i.test(line)) return;
    if (/^\d+(?:\.\d+)?\s*bed$/i.test(line)) return;
    if (/^\d+(?:\.\d+)?\s*bath$/i.test(line)) return;
    if (/^[\d,-]+\s*ft²$/i.test(line)) return;
    if (/^\$\d+ per ft²$/i.test(line)) return;
    if (/^\d+ rooms?$/i.test(line)) return;
    if (/months? free|month free|lease/i.test(line)) {
      notes.push(`Concession: ${line}`);
      return;
    }
    if (/^Listing by /i.test(line)) {
      notes.push(line);
      return;
    }
    if (/Base rent only|full breakdown/i.test(line)) {
      notes.push(line);
      return;
    }
    other.push(line);
  });

  const hasUseful =
    Boolean(parsed.address) ||
    Boolean(parsed.neighborhood) ||
    parsed.rent != null ||
    parsed.netEffective != null ||
    Boolean(parsed.aptNumber) ||
    Boolean(parsed.listingUrl) ||
    parsed.bedrooms != null ||
    parsed.bathrooms != null;

  if (!hasUseful) return null;
  parsed.organizedNotes = buildOrganizedNotes(notes, other);
  return parsed;
}

module.exports = { parseListingText };
