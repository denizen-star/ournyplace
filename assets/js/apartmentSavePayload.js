/**
 * Build API payload for PUT/POST /api/apartments from a loaded apartment row.
 * Optional `overrides` shallow-merge (e.g. { status: 'shortlisted' }).
 */
(function (global) {
  function apartmentToSavePayload(apartment, overrides) {
    var o = overrides || {};
    var srcUrl =
      o.sourceUrl != null
        ? o.sourceUrl
        : apartment.source_url != null && apartment.source_url !== ''
          ? apartment.source_url
          : o.listingUrl != null
            ? o.listingUrl
            : apartment.listing_url || '';
    return {
      id: o.id != null ? o.id : apartment.id,
      neighborhood: o.neighborhood != null ? o.neighborhood : apartment.neighborhood || '',
      address: o.address != null ? o.address : apartment.address,
      aptNumber: o.aptNumber != null ? o.aptNumber : apartment.apt_number || '',
      rent: o.rent != null ? o.rent : apartment.rent_cents != null ? apartment.rent_cents / 100 : null,
      netEffective:
        o.netEffective != null ? o.netEffective : apartment.net_effective_cents != null ? apartment.net_effective_cents / 100 : null,
      brokerFee: o.brokerFee != null ? o.brokerFee : apartment.broker_fee_cents != null ? apartment.broker_fee_cents / 100 : null,
      deposit: o.deposit != null ? o.deposit : apartment.deposit_cents != null ? apartment.deposit_cents / 100 : null,
      amenitiesFees:
        o.amenitiesFees != null ? o.amenitiesFees : apartment.amenities_fees_cents != null ? apartment.amenities_fees_cents / 100 : null,
      totalMoveIn:
        o.totalMoveIn != null ? o.totalMoveIn : apartment.total_move_in_cents != null ? apartment.total_move_in_cents / 100 : null,
      bedrooms: o.bedrooms != null ? o.bedrooms : apartment.bedrooms != null ? apartment.bedrooms : 1,
      bathrooms: o.bathrooms != null ? o.bathrooms : apartment.bathrooms != null ? apartment.bathrooms : 1,
      squareFeet: o.squareFeet != null ? o.squareFeet : apartment.square_feet,
      unitFeatures: o.unitFeatures != null ? o.unitFeatures : apartment.unit_features || [],
      amenities: o.amenities != null ? o.amenities : apartment.amenities || [],
      moveInDate: o.moveInDate != null ? o.moveInDate : apartment.move_in_date || null,
      status: NyhomeStatus.normalizeStatus(o.status != null ? o.status : apartment.status || 'new'),
      listingUrl: o.listingUrl != null ? o.listingUrl : apartment.listing_url || '',
      sourceUrl: srcUrl,
      importStatus: o.importStatus != null ? o.importStatus : apartment.import_status || 'manual',
      notes: o.notes != null ? o.notes : apartment.notes || '',
      imageUrls:
        o.imageUrls != null
          ? o.imageUrls
          : (apartment.images || []).map(function (img) {
              return img.image_url;
            }).filter(Boolean),
    };
  }

  global.NyhomeApartmentPayload = {
    apartmentToSavePayload: apartmentToSavePayload,
  };
})(typeof self !== 'undefined' ? self : this);
