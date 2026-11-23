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
html/                 Pages: index (home), about, gallery, videos (gallery on the Events tab), contact, book
css/site.css          The whole design system: colours, type, layout, every page
js/data.js            Films and stills shown on the site. Edit this to add real work.
js/site.js            Shared: intro, header, menu, video player, film drawer, photo viewer, motion
js/iris.js            The camera iris drawn in the home page hero
js/home.js            Home: hero entrance (letters and iris) and the showreel player
js/gallery.js         Gallery: Photoshoots / Events tabs, photo grid and film grid
js/contact.js         Leave a message form (emails Dreas's Gmail through /api/contact)
js/book.js            Booking calendar and form
media/brand/          Logo (black and white versions, transparent background), favicon
media/films/          Video files (.mp4) and their poster frames (.jpg)
media/stills/         Photos
media/fonts/          Hubot Sans (condensed cut) and Hanken Grotesk (self-hosted, SIL Open Font License)
media/hero/           The hero photograph shown inside the aperture
vendor/gsap/          GSAP 3.15.1 + ScrollTrigger (self-hosted, GSAP Standard License)
google-apps-script/   Code.gs that Dreas deploys in his Google account (calendar feed and contact emails)
api/                  Vercel serverless functions
  availability.js       GET  /api/availability
  booking-options.js    GET  /api/booking-options
  bookings.js           POST /api/bookings
  contact.js            POST /api/contact
  _lib/                 Shared server code (not exposed as endpoints)
    options.js          Event types and services shown on the booking form. Edit here.
tests/                Backend tests (npm test)
scripts/              Local dev server (npm run dev)
```

The API uses only Node.js built-ins, so there is nothing to install. The header, menu and footer are repeated in each HTML page, so change them in all six files.

## Design notes

The original layout (same pages, sections and headings), rebuilt as a luxury black site.

- **Colour:** deep black with ivory text and a stone grey second tone, so it sits with the black and white logo. Flat colour only, no gradients or glows. A light / dark switch in the nav swaps to warm off-white with near-black text, and the choice is remembered on that device.
- **Type:** Hubot Sans in an extra bold condensed cut for headings (like a film title) and Hanken Grotesk for text and labels.
- **Navigation:** on wide screens a floating glass bar, on phones a slim full-width bar, both blurring the page underneath. The bar is `position: fixed` with the blur on the bar itself, which Firefox handles reliably. The current page is bold white and the other links are dimmed. On phones a plus-shaped menu button (it turns into a cross) opens a full-screen menu that grows out of it as a circle. A back-to-top button appears bottom right once you scroll.
- **Buttons:** see-through with an ivory border and slightly rounded corners. They fill ivory when pressed or selected. Solid ivory for the main action and an outline for the rest. On hover the fill slides across.
- **Phones:** the hero splits the name over two lines around the aperture, the Why choose us photo is hidden, the reviews become a swipeable carousel that fades at the edges, the album and both gallery tabs fade out under a See More button that opens Instagram, and the gallery uses a staggered photo layout and full-width film cards.
- **Hero:** SHOTBYDREAS across the top, with the camera iris in the middle opening onto a photograph. On load the letters rise out of their line blurred and stretched, snap into focus from the middle outwards while the spacing tightens, and DREAS fades from ivory to grey letter by letter.
- **Motion (GSAP):** headings rise word by word out of their line, a short logo intro on the first page of a visit, the brand letters rising and the iris opening, the iris narrowing as you scroll away, sections rising in (everything moves straight up, never in from the side or tilted; on phones photos and films open upwards out of their frames, pictures zoom out gently as you scroll, and the banner opens from an inset card to full width), hairline rules drawing in, cards arriving in turn, slow parallax on photos, magnetic buttons, looping photos inside the ovals, and the "Check out our latest covered event!" marquee. For visitors who have reduced motion switched on, the movement is replaced by soft fades, and the site still works if GSAP fails to load.
- Arrows only appear on the calendar and the photo viewer, with a thick stroke. There are no camera or equipment details anywhere on the site.

## Replacing the placeholder content

Everything marked as a placeholder on the site needs Dreas's real material:

1. **Films:** put each video in `media/films/` (MP4, H.264, ideally under 10 MB, 1080p is enough on the web) with a poster frame `.jpg`, then edit the entries in `js/data.js` (title, type, location, logline, role, deliverables).
2. **Hero photo:** replace `media/hero/hero.jpg` (landscape or square, about 1800px wide). It shows inside the aperture on the home page.
3. **Stills:** put photos in `media/stills/` (JPEG, about 1800px on the long edge) and update the `stills` list in `js/data.js`. Any mix of portrait and landscape works.
4. **Copy:** the About bio and the three sample reviews on the home page.
5. Remove the "placeholders" note in the footer of each page once real work is in.

## API

| Method | Route | Response |
| --- | --- | --- |
| GET | `/api/availability` | `{ timeZone, today, firstBookable, lastBookable, maxDates, unavailable: ["YYYY-MM-DD"], checkedAt }`. On failure: `503 CALENDAR_NOT_CONFIGURED` or `502 CALENDAR_UNAVAILABLE`, both with `error.window` so the form can still work. |
| GET | `/api/booking-options` | `{ eventTypes, services, maxDates }` |
| POST | `/api/contact` | `{ sent: true }` once the message is emailed to Dreas. Errors: `422 VALIDATION_ERROR` with `error.fields`, `429 TOO_MANY_MESSAGES`, `502 SEND_FAILED`, `503 CONTACT_NOT_CONFIGURED`. |
| POST | `/api/bookings` | `{ whatsappUrl, message, availabilityChecked }`. Errors: `422 VALIDATION_ERROR` with `error.fields`, `409 DATES_UNAVAILABLE` with `error.dates`, `400/413/415` for bad requests, `503 BOOKING_NOT_CONFIGURED`. |

Contact body: `{ name, email, subject?, message }`. The contact form uses the same `CALENDAR_SCRIPT_URL` and `CALENDAR_SCRIPT_KEY`.

Booking body: `{ name, phone, email?, eventType, service, dates: ["YYYY-MM-DD"], startTime? ("HH:MM"), location, budget?, details? }`.

## Setup

### 1. Google Calendar and Gmail access (one time, free)

The site reads only Dreas's busy times, never the names or details of his events. The same script also emails contact form messages to his Gmail. Use **option A**. It is free and does not need the Google Cloud Console or a card.

**Option A: Apps Script (recommended)**

Dreas does these steps while signed in to his own Google account (or shares his screen with you):

1. Go to [script.google.com/create](https://script.google.com/create). Delete the sample code and paste in everything from `google-apps-script/Code.gs`.
2. Change `SECRET_KEY` near the top to a long random string (e.g. from a password generator). Keep a copy of it.
3. In the left panel, click **Services (+)**, choose **Google Calendar API** and click **Add**.
4. Click **Deploy > New deployment**, click the gear icon and choose **Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**.
5. Google asks for permission to see his calendar and to send email as him (for the contact form). Click **Authorize access**, pick his account, then **Advanced > Go to (project name) > Allow**. (The warning appears because the script is his own and not published by Google. It is safe.)
6. Copy the **Web app URL** (it ends in `/exec`).

To check it works, open the URL in a browser. It should show `{"error":"unauthorized"}`, which means the script is running and protected by the key.

If you change the script later, use **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy**, so the URL stays the same.

**Already deployed the calendar-only version?** Paste the new `Code.gs` over the old one (keep the same `SECRET_KEY`), then deploy a new version as above. Google asks for the new "send email" permission once. Contact messages go to the Gmail address of the account running the script. To send them somewhere else, set `CONTACT_TO` near the top of the script.

**Option B: Google Cloud service account**

Only if you already use the Google Cloud Console. Create a project, enable the Google Calendar API, create a service account with a JSON key, and have Dreas share his calendar with the service account email using **See only free/busy (hide details)**. Then set the three `GOOGLE_*` variables below instead of the `CALENDAR_SCRIPT_*` ones.

### 2. Environment variables

Add these in Vercel under **Project Settings > Environment Variables** (and in a local `.env` file for development, see `.env.example`):

| Variable | Value |
| --- | --- |
| `WHATSAPP_NUMBER` | Dreas's WhatsApp number, international format, e.g. `2348136078551` |
| `CALENDAR_SCRIPT_URL` | Option A: the Web app URL from step 1.6 (also used by the contact form) |
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

