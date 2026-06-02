# Hildernw Mining Limited — Website

Official marketing website for **Hildernw Mining Limited** — a clean, fast static site built with HTML, CSS, and JavaScript. It showcases mining services, operations, sustainability, and careers, with real-time form submissions and dynamic job listings via **Firebase Firestore**.

**Live site:** [https://hildernwmining.co.ke](https://hildernwmining.co.ke)  
**Repository:** [https://github.com/humphreyabwao/Hilderwn-Project](https://github.com/humphreyabwao/Hilderwn-Project)

---

## Features

- Responsive design (desktop, tablet, mobile) with yellow & light-blue branding
- Two-tier navigation with dropdowns and scroll-aware lower nav
- Hero background slideshow with smooth transitions
- Clean URL structure (`/about`, `/services/vat-leach`, `/careers`, etc.)
- SEO: meta tags, Open Graph, Twitter Cards, JSON-LD, `sitemap.xml`, `robots.txt`
- Security headers via meta tags
- **Firestore forms** — contact, service enquiries, and career applications
- **Dynamic careers** — vacancies loaded in real time from Firestore

---

## Tech stack

| Layer        | Technology                          |
|-------------|--------------------------------------|
| Markup      | HTML5 (semantic, accessible)         |
| Styling     | CSS3 (custom properties, animations) |
| Scripts     | Vanilla JavaScript                   |
| Backend     | Firebase Firestore (client SDK)      |
| Fonts       | Google Fonts — Montserrat            |

---

## Project structure

```
Hildernw/
├── index.html              # Homepage
├── about/index.html        # About Us & Our Plant
├── sustainability/index.html
├── careers/index.html      # Dynamic job listings
├── services/
│   ├── index.html          # Services overview
│   ├── vat-leach/
│   ├── equipment-rental/
│   └── mining-support/
├── assets/images/          # Site photos & logo
├── css/styles.css          # Global styles
├── js/
│   ├── main.js             # Nav, hero, scroll, UI
│   ├── firebase.js         # Firestore form submissions
│   └── careers.js          # Live vacancies listener
├── robots.txt
├── sitemap.xml
└── README.md
```

---

## Local development

No build step required. Serve the project root with any static server:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

Open `http://localhost:8080` in your browser.

> **Note:** Clean URLs (`/about` instead of `/about/index.html`) depend on your host rewriting rules. Locally you may need to open `/about/index.html` directly, or configure your server for extensionless paths.

---

## Firebase setup

Project: **hildernw-project**  
Configuration is in `js/firebase.js`.

### Form collections

| Page / form              | Firestore collection          |
|--------------------------|-------------------------------|
| Contact (homepage)       | `contact_enquiries`           |
| Vat Leach rental         | `vat_leach_rentals`           |
| Equipment rental         | `equipment_rentals`           |
| Mining support enquiry   | `mining_support_enquiries`    |
| Career applications      | `career_applications`         |

Each submission includes field values plus `submitted_at` (ISO timestamp) and `page` (URL path).

### Careers — `vacancies` collection

Add documents in Firestore to show jobs on `/careers`. Example fields:

| Field              | Type    | Description                    |
|--------------------|---------|--------------------------------|
| `title`            | string  | Job title                      |
| `employment_type`  | string  | e.g. Full-time                 |
| `location`         | string  | e.g. Warianda                  |
| `posted_label`     | string  | e.g. June 2026                 |
| `description`      | string  | Role summary (use `\n` for paragraphs) |
| `requirements`     | array   | List of requirement strings    |
| `benefits`         | array   | List of benefit strings        |
| `active`           | boolean | `false` hides the listing      |
| `sort_order`       | number  | Lower numbers appear first     |

Changes in Firebase Console update the careers page automatically.

### Recommended Firestore rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /vacancies/{id} {
      allow read: if true;
      allow write: if false;
    }
    match /career_applications/{id} {
      allow create: if request.resource.data.keys().hasAll(['name', 'email', 'phone']);
      allow read, update, delete: if false;
    }
    match /contact_enquiries/{id},
          /vat_leach_rentals/{id},
          /equipment_rentals/{id},
          /mining_support_enquiries/{id} {
      allow create: if true;
      allow read, update, delete: if false;
    }
  }
}
```

Manage vacancies and read submissions in the [Firebase Console](https://console.firebase.google.com/).

---

## Deployment

1. Upload the repository contents to your web host (or connect GitHub for auto-deploy).
2. Enable **clean URLs** / directory index so `/about` serves `about/index.html`.
3. Point your domain (e.g. `hildernwmining.co.ke`) to the host.
4. Ensure Firestore rules allow public **read** on `vacancies` and **create** on form collections.
5. Submit `sitemap.xml` in [Google Search Console](https://search.google.com/search-console).

---

## Contact

| | |
|---|---|
| **Email** | info@hildernwmining.co.ke |
| **Phone** | +254 768 834625 |
| **Location** | Warianda Area, Next to Warianda Pri School, Kenya |

---

## License

© 2026 Hildernw Mining Limited. All rights reserved.
