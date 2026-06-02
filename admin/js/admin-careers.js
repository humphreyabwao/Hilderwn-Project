'use strict';

initAdminEnquiryModule({
  idPrefix: 'careers',
  collection: 'career_applications',
  statKey: 'careers',
  kind: 'careers',
  backfillFn: 'backfillCareerApplicationsClientIds',
  emptyText: 'No applications match your filters.',
  moduleLabel: 'job applications',
  statuses: {
    new: { label: 'New', pill: 'pill--new' },
    'under-review': { label: 'Under review', pill: 'pill--review' },
    interview: { label: 'Interview', pill: 'pill--interview' },
    hired: { label: 'Hired', pill: 'pill--hired' },
    rejected: { label: 'Not selected', pill: 'pill--rejected' },
    contacted: { label: 'Contacted', pill: 'pill--contacted' },
    replied: { label: 'Replied', pill: 'pill--replied' },
    closed: { label: 'Archived', pill: 'pill--closed' }
  },
  statusActions: [
    { status: 'under-review', label: 'Under review' },
    { status: 'interview', label: 'Interview' },
    { status: 'hired', label: 'Hired' },
    { status: 'rejected', label: 'Not selected' },
    { status: 'contacted', label: 'Contacted' },
    { status: 'replied', label: 'Replied' },
    { status: 'closed', label: 'Archive' },
    { status: 'new', label: 'Reset to new' }
  ]
});
