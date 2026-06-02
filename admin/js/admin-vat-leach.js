'use strict';

initAdminEnquiryModule({
  idPrefix: 'vat-leach',
  collection: 'vat_leach_rentals',
  statKey: 'vat-leach',
  kind: 'vat-leach',
  backfillFn: 'backfillVatLeachClientIds',
  emptyText: 'No rental requests match your filters.',
  moduleLabel: 'vat leach rentals'
});
