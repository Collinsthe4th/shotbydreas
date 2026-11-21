# shotbydreas

A videography website for SHOTBYDREAS that features an event booking system. Clients pick open dates (read live from Dreas's Google Calendar), fill in their event details, and send the booking to Dreas on WhatsApp.

## How the booking works

1. The booking page (`html/book.html` + `js/book.js`) loads the open dates from `GET /api/availability`, which reads Dreas's calendar through a small Google Apps Script in his account.
2. Any event on Dreas's Google Calendar books the whole day. Events set to **Show as: Free** do not block a day, so he can keep personal reminders on the same calendar.
3. When the client submits, `POST /api/bookings` validates the form, checks the dates again against the calendar, and returns a WhatsApp click-to-chat link with the details pre-filled.
4. The client taps **Send on WhatsApp**, and the message opens in their WhatsApp addressed to Dreas. Nothing is stored on the server.
5. When Dreas confirms a booking, he adds it to his calendar and that date disappears from the site within a few minutes.

If the calendar cannot be reached, the form still works. Clients can pick any date in the booking window, and Dreas confirms availability on WhatsApp.

## Project structure

```text
html/                 Pages: index (home), videos (films), gallery (stills), about, contact, book
css/site.css          The whole design system (tokens, type, layout, components, every page)
js/data.js            Films and stills shown on the site. Edit this to add real work.
js/site.js            Shared: header, menu, clock, video player, film drawer, cursor, GSAP motion
js/work.js            Home film index + Films page filter grid
js/gallery.js         Stills grid + lightbox
js/contact.js         Quick question form (opens WhatsApp)
js/book.js            Booking calendar and form
media/brand/          Logo (white and black, transparent background), favicon
media/films/          Video files (.mp4) and their poster frames (.jpg)
media/stills/         Photos
media/fonts/          Bodoni Moda, Montserrat, JetBrains Mono (self-hosted, SIL Open Font License)
vendor/gsap/          GSAP 3.15.1 + ScrollTrigger (self-hosted, GSAP Standard License)
google-apps-script/   Code.gs that Dreas deploys in his Google account (free calendar feed)
api/                  Vercel serverless functions
  availability.js       GET  /api/availability
  booking-options.js    GET  /api/booking-options
  bookings.js           POST /api/bookings
  _lib/                 Shared server code (not exposed as endpoints)
    options.js          Event types and services shown on the booking form. Edit here.
tests/                Backend tests (npm test)
scripts/              Local dev server (npm run dev)
```

The API uses only Node.js built-ins, so there is nothing to install. The header, menu and footer are repeated in each HTML page, so change them in all six files.

## Design notes

"Darkroom Editorial": near-black background, warm off-white text and the brand gold used only for small accents (timecodes, active states, the booking button). Headlines use Bodoni Moda, a high-contrast serif that echoes the SD monogram. Labels use Montserrat, which matches the wordmark, and camera details use JetBrains Mono.

Motion (GSAP, in `js/site.js`): headline lines rise out of masks on load, the showreel opens like an aperture as it scrolls in, sections fade up once, photos drift slightly slower than their frames, and the home contact sheet pins and scrolls sideways on desktop. Everything is switched off for visitors who set "reduce motion", and the site still works fully if GSAP fails to load.

## Replacing the placeholder content

Everything marked as a placeholder on the site needs Dreas's real material:

1. **Films:** put each video in `media/films/` (MP4, H.264, ideally under 10 MB, 1080p is enough on the web) with a poster frame `.jpg`, then edit the entries in `js/data.js` (title, type, location, logline, deliverables and so on).
2. **Showreel:** replace `media/films/reel.mp4` and `reel.jpg`. The headline clip on the home page uses `film-gold.mp4`.
3. **Stills:** put photos in `media/stills/` (JPEG, about 1800px on the long edge) and update the `stills` list in `js/data.js`. `span` is the width out of 12 columns, so make each row add up to 12.
4. **Copy:** the About bio, the kit list on the home page, the two sample quotes, and the FAQ answers in `html/about.html`.
5. Remove the "placeholders" note in the footer of each page once real work is in.

## API

| Method | Route | Response |
| --- | --- | --- |
| GET | `/api/availability` | `{ timeZone, today, firstBookable, lastBookable, maxDates, unavailable: ["YYYY-MM-DD"], checkedAt }`. On failure: `503 CALENDAR_NOT_CONFIGURED` or `502 CALENDAR_UNAVAILABLE`, both with `error.window` so the form can still work. |
| GET | `/api/booking-options` | `{ eventTypes, services, maxDates }` |
| POST | `/api/bookings` | `{ whatsappUrl, message, availabilityChecked }`. Errors: `422 VALIDATION_ERROR` with `error.fields`, `409 DATES_UNAVAILABLE` with `error.dates`, `400/413/415` for bad requests, `503 BOOKING_NOT_CONFIGURED`. |

Booking body: `{ name, phone, email?, eventType, service, dates: ["YYYY-MM-DD"], startTime? ("HH:MM"), location, budget?, details? }`.

## Setup

### 1. Google Calendar access (one time, free)

The site reads only Dreas's busy times, never the names or details of his events. Use **option A**. It is free and does not need the Google Cloud Console or a card.

**Option A: Apps Script (recommended)**

Dreas does these steps while signed in to his own Google account (or shares his screen with you):

1. Go to [script.google.com/create](https://script.google.com/create). Delete the sample code and paste in everything from `google-apps-script/Code.gs`.
2. Change `SECRET_KEY` near the top to a long random string (e.g. from a password generator). Keep a copy of it.
3. In the left panel, click **Services (+)**, choose **Google Calendar API** and click **Add**.
4. Click **Deploy > New deployment**, click the gear icon and choose **Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**.
5. Google asks for permission to see his calendar. Click **Authorize access**, pick his account, then **Advanced > Go to (project name) > Allow**. (The warning appears because the script is his own and not published by Google. It is safe.)
6. Copy the **Web app URL** (it ends in `/exec`).

To check it works, open the URL in a browser. It should show `{"error":"unauthorized"}`, which means the script is running and protected by the key.

If you change the script later, use **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy**, so the URL stays the same.

**Option B: Google Cloud service account**

Only if you already use the Google Cloud Console. Create a project, enable the Google Calendar API, create a service account with a JSON key, and have Dreas share his calendar with the service account email using **See only free/busy (hide details)**. Then set the three `GOOGLE_*` variables below instead of the `CALENDAR_SCRIPT_*` ones.

### 2. Environment variables

Add these in Vercel under **Project Settings > Environment Variables** (and in a local `.env` file for development, see `.env.example`):

| Variable | Value |
| --- | --- |
| `WHATSAPP_NUMBER` | Dreas's WhatsApp number, international format, e.g. `2348136078551` |
| `CALENDAR_SCRIPT_URL` | Option A: the Web app URL from step 1.6 |
| `CALENDAR_SCRIPT_KEY` | Option A: the `SECRET_KEY` you set in the script |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Option B only: `client_email` from the JSON key file |
| `GOOGLE_PRIVATE_KEY` | Option B only: `private_key` from the JSON key file, including the BEGIN/END lines |
| `GOOGLE_CALENDAR_ID` | Option B only: the Calendar ID (his Gmail address for his main calendar) |
| `BOOKING_MIN_NOTICE_DAYS` | Optional. Days of notice needed (default `2`) |
| `BOOKING_WINDOW_DAYS` | Optional. How far ahead clients can book (default `180`) |
| `BOOKING_MAX_DATES` | Optional. Most dates in one request (default `5`) |
| `BOOKING_TIMEZONE` | Optional. Default `Africa/Lagos` |

If both options are set, option A is used. Redeploy after changing environment variables.

### 3. Deploy on Vercel

Import the GitHub repo in Vercel. No framework preset and no build command are needed. `vercel.json` sends `/` to `html/index.html`, and everything in `api/` becomes a serverless function.

## Local development

Requires Node.js 22.

```bash
cp .env.example .env    # then fill in the values
npm run dev             # http://localhost:3000
npm test                # backend tests
```

Without the Google variables, the booking page still works in "Dreas will confirm" mode.

