/**
 * Listing paste parsing (keep in sync with lib/listingTextParse.js).
 */
(function (global) {
  function buildOrganizedNotes(notes, other) {
    var sections = [];
    var uniqueNotes = Array.from(new Set(notes));
    var uniqueOther = Array.from(new Set(other));
    if (uniqueNotes.length) sections.push(uniqueNotes.join('\n'));
    if (uniqueOther.length) sections.push('Other:\n' + uniqueOther.join('\n'));
    return sections.join('\n\n');
  }

  function looksLikeStreetCommaSegment(s) {
    var t = String(s || '').trim();
    if (!/^\d+\s+[A-Za-z]/.test(t)) return false;
    if (/month|bed|bath|ft²|rooms?|lease|free|available|open house|by appt|for rent|^1 of \d+/i.test(t)) return false;
    return true;
  }

  function isLikelyStateOrZipSegment(s) {
    var t = String(s || '').trim();
    if (/^(United States|USA|US)$/i.test(t)) return true;
    return /^[A-Z]{2}(\s+[\d-]{4,10})?$/i.test(t);
  }

  function tryParseCommaMapsLine(line, parsed, consumed, notes, index) {
    if (line.indexOf(',') === -1) return false;
    if (!/^\d/.test(line.trim())) return false;
    var parts = line.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    if (parts.length < 2) return false;
    if (!looksLikeStreetCommaSegment(parts[0])) return false;

    parsed.address = parts[0];
    var skipGeo = { 'united states': true, usa: true, us: true };
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i];
      if (skipGeo[p.toLowerCase()]) break;
      if (isLikelyStateOrZipSegment(p)) break;
      parsed.neighborhood = p;
      break;
    }
    consumed[index] = true;
    notes.push('Address (from maps-style line)');
    return true;
  }

  function tryParseStreetWithUnit(line, parsed, consumed, index) {
    var m = line.match(/^(\d+[A-Za-z0-9\s,.'-]+?)\s+#\s*([A-Za-z0-9-]+)$/i);
    if (!m) return false;
    var street = m[1].trim().replace(/[,\s]+$/g, '');
    if (!street || !/\d/.test(street)) return false;
    parsed.address = street;
    parsed.aptNumber = m[2] || '';
    consumed[index] = true;
    return true;
  }

  function tryParseUnitOnlyLine(line, parsed, consumed, index) {
    var m = line.match(/^#([A-Za-z0-9-]+)$/i);
    if (!m) return false;
    parsed.aptNumber = m[1];
    consumed[index] = true;
    return true;
  }

  function looksLikeNeighborhoodName(s) {
    var t = String(s || '').trim();
    if (t.length < 2 || t.length > 80) return false;
    if (/^\$|https?:\/\//i.test(t)) return false;
    if (/^\d+(?:\.\d+)?\s*(bed|bath|ft²|rooms?)\b/i.test(t)) return false;
    if (/^[-\d]+\s*ft²$/i.test(t)) return false;
    return /^[A-Za-z]/.test(t) && /^[A-Za-z\s.'-]+$/i.test(t);
  }

  function parseListingText(text) {
    if (!text || !String(text).trim()) return null;
    var lines = String(text).split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    var parsed = { amenities: [] };
    var notes = [];
    var other = [];
    var consumed = {};

    lines.forEach(function (line, index) {
      var neighborhoodInMatch = line.match(/^Rental unit in (.+)$/i);
      if (neighborhoodInMatch) {
        parsed.neighborhood = neighborhoodInMatch[1].trim();
        consumed[index] = true;
        notes.push('Listing type: Rental unit');
        return;
      }

      if (/^Rental unit$/i.test(line)) {
        consumed[index] = true;
        notes.push('Listing type: Rental unit');
        var next = lines[index + 1];
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

      var linkMatch = line.match(/^https?:\/\/\S+$/i);
      if (linkMatch) {
        parsed.listingUrl = line;
        consumed[index] = true;
      }
    });

    for (var i = 0; i < lines.length; i++) {
      if (/^\$[\d,]+$/.test(lines[i])) {
        var amount = Number(lines[i].replace(/[$,]/g, ''));
        var next = lines[i + 1] || '';
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
          notes.push('Additional monthly fee: $' + amount);
        }
      } else {
        var inlineNet = lines[i].match(/^\$([\d,]+)\s+net effective base rent$/i);
        if (inlineNet) {
          parsed.netEffective = Number(inlineNet[1].replace(/,/g, ''));
          consumed[i] = true;
        }
      }
    }

    var sqftMatch = String(text).match(/([\d,]+|-)\s*ft²/i);
    if (sqftMatch && sqftMatch[1] !== '-') parsed.squareFeet = Number(sqftMatch[1].replace(/,/g, ''));

    var bedMatch = String(text).match(/(\d+(?:\.\d+)?)\s*bed\b/i);
    if (bedMatch) parsed.bedrooms = Number(bedMatch[1]);

    var bathMatch = String(text).match(/(\d+(?:\.\d+)?)\s*bath\b/i);
    if (bathMatch) parsed.bathrooms = Number(bathMatch[1]);

    lines.forEach(function (line, index) {
      if (consumed[index]) return;
      if (/^Save$/i.test(line) || /^For Rent$/i.test(line)) return;
      if (/^Rental unit$/i.test(line)) return;
      if (/^\d+(?:\.\d+)?\s*bed$/i.test(line)) return;
      if (/^\d+(?:\.\d+)?\s*bath$/i.test(line)) return;
      if (/^[\d,-]+\s*ft²$/i.test(line)) return;
      if (/^\$\d+ per ft²$/i.test(line)) return;
      if (/^\d+ rooms?$/i.test(line)) return;
      if (/months? free|month free|lease/i.test(line)) {
        notes.push('Concession: ' + line);
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

    var hasUseful =
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

  global.NyhomeListingText = {
    parseListingText: parseListingText,
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
