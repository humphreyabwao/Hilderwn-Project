# Deployment & security checklist

Use this before every production deploy for **Hildernw Mining**.

## 1. Deploy commands

```bash
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Deploy **rules and indexes before** hosting when security rules changed.

## 2. Admin access (required)

Only listed emails can use the admin panel or change data.

1. Create users in [Firebase Console → Authentication](https://console.firebase.google.com/) (Email/Password).
2. Add each admin email in **both** files (keep them in sync):
   - `firestore.rules` → `isAdmin()` list
   - `admin/js/admin-config.js` → `allowedEmails`

Example:

```javascript
// admin/js/admin-config.js
allowedEmails: [
  'info@hildernwmining.co.ke',
  'your.name@company.com'
]
```

```javascript
// firestore.rules — same emails in isAdmin()
request.auth.token.email in [
  'info@hildernwmining.co.ke',
  'your.name@company.com'
]
```

## 3. Firebase Console settings

- **Authentication**: Enable Email/Password only; disable unused providers.
- **Authorized domains**: `hildernwmining.co.ke`, `hildernw-project.web.app`, `hildernw-project.firebaseapp.com`, `localhost` (dev only).
- **Firestore**: Production mode with deployed rules (never open rules in production).
- **App Check** (recommended): Enable reCAPTCHA Enterprise for web to reduce form abuse.

## 4. Security features in this project

| Area | Protection |
|------|------------|
| Public forms | Whitelisted fields, length limits, honeypot, submit cooldown, email validation |
| Firestore | Public can **create** enquiries only; cannot set admin fields or non-`new` status |
| Admin data | Read/update/delete only for `isAdmin()` emails |
| Vacancies | Public read; admin-only write |
| Counters | Increment-by-one only for anonymous users |
| Hosting | `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `Permissions-Policy` |
| Admin | `noindex`, no-store cache, login gate, unauthorised email sign-out |

## 5. Post-deploy smoke test

1. Submit a test contact form on the live site → appears in admin with status **New**.
2. Sign in to `/admin` with an authorised email.
3. Sign in with a **non-listed** email → should be rejected at login.
4. Open **Careers** → published vacancies visible on `/careers`.
5. Change an enquiry status → notification badge count updates.
6. Dashboard **Today's activity** shows only today's items; **Clear** works.

## 6. Ongoing maintenance

- Rotate admin passwords periodically.
- Remove ex-staff emails from `firestore.rules` and `admin-config.js`, then redeploy rules.
- Monitor Firebase **Usage** for unusual spikes (spam).
- Keep Firebase SDK on a supported 10.x release.

## 7. What is not included (optional upgrades)

- Cloud Functions for server-side rate limiting or email alerts
- Custom claims instead of email allowlists
- Automated backups (enable Firestore scheduled exports in Google Cloud)
