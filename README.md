# shotbydreas

A videography website for SHOTBYDREAS that features an event booking system. Clients pick open dates (read live from Dreas's Google Calendar), fill in their event details, and send the booking to Dreas on WhatsApp.

## How the booking works

1. The booking page (`html/book.html` + `js/book.js`) loads the open dates from `GET /api/availability`.
2. Any event on Dreas's Google Calendar books the whole day. Events set to **Show as: Free** do not block a day, so he can keep personal reminders on the same calendar.
3. When the client submits, `POST /api/bookings` validates the form, checks the dates again against the calendar, and returns a WhatsApp click-to-chat link with the details pre-filled.
4. The client taps **Send on WhatsApp**, and the message opens in their WhatsApp addressed to Dreas. Nothing is stored on the server.
5. When Dreas confirms a booking, he adds it to his calendar and that date disappears from the site within a few minutes.

If the calendar cannot be reached, the form still works. Clients can pick any date in the booking window, and Dreas confirms availability on WhatsApp.

## Project structure

```text
html/            Site pages (index, about, gallery, videos, contact, book)
css/             Page styles
js/book.js       Booking page logic (calendar, form, WhatsApp handoff)
index.js         Shared nav and gallery script
bgs/             Images and videos (add these, see below)
api/             Vercel serverless functions
  availability.js      GET  /api/availability
  booking-options.js   GET  /api/booking-options
  bookings.js          POST /api/bookings
  _lib/                Shared server code (not exposed as endpoints)
    options.js         Event types and services shown on the form. Edit here.
tests/           Backend tests (npm test)
scripts/         Local dev server (npm run dev)
```

The API uses only Node.js built-ins, so there is nothing to install.

## API

| Method | Route | Response |
| --- | --- | --- |
| GET | `/api/availability` | `{ timeZone, today, firstBookable, lastBookable, maxDates, unavailable: ["YYYY-MM-DD"], checkedAt }`. On failure: `503 CALENDAR_NOT_CONFIGURED` or `502 CALENDAR_UNAVAILABLE`, both with `error.window` so the form can still work. |
| GET | `/api/booking-options` | `{ eventTypes, services, maxDates }` |
| POST | `/api/bookings` | `{ whatsappUrl, message, availabilityChecked }`. Errors: `422 VALIDATION_ERROR` with `error.fields`, `409 DATES_UNAVAILABLE` with `error.dates`, `400/413/415` for bad requests, `503 BOOKING_NOT_CONFIGURED`. |

Booking body: `{ name, phone, email?, eventType, service, dates: ["YYYY-MM-DD"], startTime? ("HH:MM"), location, budget?, details? }`.

## Setup

### 1. Google Calendar access (one time)

The site reads only Dreas's free/busy times, never the names or details of his events.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. `shotbydreas-site`).
2. Open **APIs & Services > Library**, search for **Google Calendar API** and click **Enable**.
3. Open **IAM & Admin > Service Accounts > Create service account**. Name it `booking-site` and skip the optional roles.
4. Open the new service account, go to **Keys > Add key > Create new key > JSON**, and download the file. Keep it private.
5. Dreas opens [Google Calendar](https://calendar.google.com/) on a computer, goes to **Settings > (his calendar) > Share with specific people > Add people**, pastes the service account email (`booking-site@...iam.gserviceaccount.com`) and picks **See only free/busy (hide details)**.
6. In the same settings page, under **Integrate calendar**, copy the **Calendar ID**. For his main calendar this is his Gmail address.

### 2. Environment variables

Add these in Vercel under **Project Settings > Environment Variables** (and in a local `.env` file for development, see `.env.example`):

| Variable | Value |
| --- | --- |
| `WHATSAPP_NUMBER` | Dreas's WhatsApp number, international format, e.g. `2348136078551` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key file |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON key file, including the `-----BEGIN/END PRIVATE KEY-----` lines |
| `GOOGLE_CALENDAR_ID` | The Calendar ID from step 1.6 |
| `BOOKING_MIN_NOTICE_DAYS` | Optional. Days of notice needed (default `2`) |
| `BOOKING_WINDOW_DAYS` | Optional. How far ahead clients can book (default `180`) |
| `BOOKING_MAX_DATES` | Optional. Most dates in one request (default `5`) |
| `BOOKING_TIMEZONE` | Optional. Default `Africa/Lagos` |

Redeploy after changing environment variables.

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

## Images

The pages expect their images and videos in `bgs/` (e.g. `bgs/backdrop11.JPG`, `bgs/dreas logo.PNG`). Add that folder to the repo so the pages display correctly.
