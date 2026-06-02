'use strict';

initAdminEnquiryModule({
  idPrefix: 'mining-support',
  collection: 'mining_support_enquiries',
  statKey: 'mining-support',
  kind: 'mining-support',
  backfillFn: 'backfillMiningSupportClientIds',
  emptyText: 'No mining support enquiries match your filters.',
  moduleLabel: 'mining support enquiries'
});
