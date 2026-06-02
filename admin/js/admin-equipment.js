'use strict';

initAdminEnquiryModule({
  idPrefix: 'equipment',
  collection: 'equipment_rentals',
  statKey: 'equipment',
  kind: 'equipment',
  backfillFn: 'backfillEquipmentClientIds',
  emptyText: 'No equipment requests match your filters.',
  moduleLabel: 'equipment rentals'
});
