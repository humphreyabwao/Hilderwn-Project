'use strict';

initAdminEnquiryModule({
  idPrefix: 'contact',
  collection: 'contact_enquiries',
  statKey: 'contact',
  kind: 'contact',
  backfillFn: 'backfillContactClientIds',
  emptyText: 'No enquiries match your filters.',
  moduleLabel: 'contact enquiries'
});
