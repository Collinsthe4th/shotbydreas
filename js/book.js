// Booking page: availability calendar, form validation, and the WhatsApp handoff.
// Talks to /api/booking-options, /api/availability and /api/bookings.

(() => {
  const form = document.getElementById('booking-form');
  if (!form) return;

  const els = {
    note: document.getElementById('availability-note'),
    calendar: document.getElementById('calendar'),
    grid: document.getElementById('cal-grid'),
    month: document.getElementById('cal-month'),
    prev: document.getElementById('cal-prev'),
    next: document.getElementById('cal-next'),
    selected: document.getElementById('selected-dates'),
    formError: document.getElementById('form-error'),
    submit: document.getElementById('submit-btn'),
    success: document.getElementById('booking-success'),
    preview: document.getElementById('message-preview'),
    waLink: document.getElementById('whatsapp-link'),
    edit: document.getElementById('edit-booking'),
    eventType: document.getElementById('eventType'),
    service: document.getElementById('service'),
  };

  const state = {
    window: null, // { today, firstBookable, lastBookable, maxDates }
    booked: new Set(),
    selected: [],
    viewMonth: null, // "YYYY-MM"
    maxDates: 5,
  };

  // ---------- date helpers (dates are "YYYY-MM-DD" strings) ----------
  const toUtc = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };
  const toIso = (date) => date.toISOString().slice(0, 10);
  const addDays = (iso, n) => {
    const d = toUtc(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return toIso(d);
  };
  const addMonths = (ym, n) => {
    const [y, m] = ym.split('-').map(Number);
    return toIso(new Date(Date.UTC(y, m - 1 + n, 1))).slice(0, 7);
  };
  const fmt = (iso, opts) => toUtc(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
  const shortDate = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const longDate = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Fallback window if the API cannot be reached at all (Lagos is UTC+1 all year).
  function localWindow() {
    const today = toIso(new Date(Date.now() + 60 * 60 * 1000));
    return { today, firstBookable: addDays(today, 2), lastBookable: addDays(today, 180), maxDates: 5 };
  }

  async function getJson(url, init) {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }

  // ---------- loading ----------
  async function init() {
    const [options, availability] = await Promise.allSettled([
      getJson('/api/booking-options'),
      getJson('/api/availability'),
    ]);

    if (options.status === 'fulfilled' && options.value.ok) {
      fillSelect(els.eventType, options.value.body.eventTypes);
      fillSelect(els.service, options.value.body.services);
    } else {
      showFormError('We could not load the booking form. Please refresh the page, or contact us on WhatsApp.');
      els.submit.disabled = true;
    }

    const result = availability.status === 'fulfilled' ? availability.value : null;
    if (result?.ok) {
      state.window = result.body;
      state.booked = new Set(result.body.unavailable);
      setNote('Greyed-out dates are already booked.');
    } else {
      // No live calendar: still allow picking any date in the window. Dreas confirms on WhatsApp.
      state.window = result?.body?.error?.window ?? localWindow();
      setNote('Live availability could not be loaded. Pick your date(s) and Dreas will confirm on WhatsApp.', true);
    }
    state.maxDates = state.window.maxDates ?? 5;
    state.viewMonth = state.window.firstBookable.slice(0, 7);
    els.calendar.setAttribute('aria-busy', 'false');
    renderCalendar();
  }

  function fillSelect(select, values = []) {
    for (const value of values) select.add(new Option(value, value));
  }

  function setNote(text, warn = false) {
    els.note.textContent = text;
    els.note.classList.toggle('is-warning', warn);
  }

  // ---------- calendar ----------
  const isMultiple = () => form.elements.dayMode.value === 'multiple';

  function dayStatus(iso) {
    const w = state.window;
    if (iso < w.firstBookable || iso > w.lastBookable) return 'out';
    if (state.booked.has(iso)) return 'booked';
    return 'free';
  }

  function renderCalendar() {
    const w = state.window;
    const first = `${state.viewMonth}-01`;
    els.month.textContent = fmt(first, { month: 'long', year: 'numeric' });
    els.prev.disabled = state.viewMonth <= w.firstBookable.slice(0, 7);
    els.next.disabled = state.viewMonth >= w.lastBookable.slice(0, 7);

    const frag = document.createDocumentFragment();
    const leading = (toUtc(first).getUTCDay() + 6) % 7; // Monday-first grid
    for (let i = 0; i < leading; i += 1) frag.append(Object.assign(document.createElement('span'), { className: 'cal-pad' }));

    for (let iso = first; iso.slice(0, 7) === state.viewMonth; iso = addDays(iso, 1)) {
      const status = dayStatus(iso);
      const picked = state.selected.includes(iso);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cal-day is-${status}${picked ? ' is-selected' : ''}${iso === w.today ? ' is-today' : ''}`;
      btn.textContent = String(Number(iso.slice(8)));
      btn.dataset.date = iso;
      btn.disabled = status !== 'free';
      btn.setAttribute('aria-pressed', String(picked));
      const label = status === 'booked' ? 'booked' : status === 'out' ? 'not available' : picked ? 'selected' : 'available';
      btn.setAttribute('aria-label', `${longDate(iso)}, ${label}`);
      frag.append(btn);
    }
    els.grid.replaceChildren(frag);
    renderSelected();
  }

  function renderSelected() {
    const items = state.selected.map((iso) => {
      const li = document.createElement('li');
      li.textContent = shortDate(iso);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-remove';
      remove.dataset.date = iso;
      remove.setAttribute('aria-label', `Remove ${longDate(iso)}`);
      remove.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
      li.append(remove);
      return li;
    });
    els.selected.replaceChildren(...items);
  }

  function toggleDate(iso) {
    clearFieldError('dates');
    if (state.selected.includes(iso)) {
      state.selected = state.selected.filter((d) => d !== iso);
    } else if (!isMultiple()) {
      state.selected = [iso];
    } else if (state.selected.length >= state.maxDates) {
      setFieldError('dates', `You can pick up to ${state.maxDates} dates. Remove one to add another.`);
      return;
    } else {
      state.selected = [...state.selected, iso].sort();
    }
    renderCalendar();
    els.grid.querySelector(`[data-date="${iso}"]`)?.focus();
  }

  els.grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.cal-day');
    if (btn && !btn.disabled) toggleDate(btn.dataset.date);
  });
  els.selected.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-remove');
    if (btn) toggleDate(btn.dataset.date);
  });
  els.prev.addEventListener('click', () => {
    state.viewMonth = addMonths(state.viewMonth, -1);
    renderCalendar();
  });
  els.next.addEventListener('click', () => {
    state.viewMonth = addMonths(state.viewMonth, 1);
    renderCalendar();
  });
  // Clear a field's error as soon as the visitor edits it.
  form.addEventListener('input', (e) => {
    if (e.target.name) clearFieldError(e.target.name);
  });

  form.addEventListener('change', (e) => {
    // Switching back to a single day keeps only the earliest pick.
    if (e.target.name === 'dayMode' && !isMultiple() && state.selected.length > 1) {
      state.selected = state.selected.slice(0, 1);
      renderCalendar();
    }
  });

  // ---------- errors ----------
  function setFieldError(name, message) {
    const el = form.querySelector(`[data-error-for="${name}"]`);
    if (!el) return showFormError(message);
    el.textContent = message;
    el.hidden = false;
    const input = form.elements[name];
    if (input?.setAttribute) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', (el.id ||= `${name}-error`));
    }
  }

  function clearFieldError(name) {
    const el = form.querySelector(`[data-error-for="${name}"]`);
    if (el) el.hidden = true;
    form.elements[name]?.removeAttribute?.('aria-invalid');
  }

  function clearErrors() {
    form.querySelectorAll('[data-error-for]').forEach((el) => (el.hidden = true));
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    els.formError.hidden = true;
  }

  function showFormError(message) {
    els.formError.textContent = message;
    els.formError.hidden = false;
  }

  function focusFirstError() {
    const first = form.querySelector('.field-error:not([hidden])');
    if (!first) return;
    const name = first.dataset.errorFor;
    const target = name === 'dates' ? els.calendar : form.elements[name];
    target?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    if (name !== 'dates') target?.focus({ preventScroll: true });
  }

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Quick checks that mirror the server rules, so most mistakes show without a round trip.
  function validateLocally(data) {
    const errors = {};
    if (data.dates.length === 0) errors.dates = 'Pick at least one date on the calendar.';
    if (!data.eventType) errors.eventType = 'Choose the type of event.';
    if (!data.service) errors.service = 'Choose a service.';
    if (data.location.trim().length < 2) errors.location = 'Enter the event location.';
    if (data.name.trim().length < 2) errors.name = 'Enter your name.';
    const digits = data.phone.replace(/\D/g, '').length;
    if (digits < 7 || digits > 15) errors.phone = 'Enter a valid phone number, e.g. +234 801 234 5678.';
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Enter a valid email address or leave it empty.';
    return errors;
  }

  // ---------- submit ----------
  function setLoading(loading) {
    els.submit.disabled = loading;
    els.submit.classList.toggle('is-loading', loading);
    els.submit.querySelector('span').textContent = loading ? 'Checking your date...' : 'Continue to WhatsApp';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const fd = new FormData(form);
    const data = {
      dates: state.selected,
      eventType: fd.get('eventType') || '',
      service: fd.get('service') || '',
      location: fd.get('location') || '',
      startTime: fd.get('startTime') || '',
      budget: fd.get('budget') || '',
      details: fd.get('details') || '',
      name: fd.get('name') || '',
      phone: fd.get('phone') || '',
      email: fd.get('email') || '',
      website: fd.get('website') || '',
    };

    const localErrors = validateLocally(data);
    if (Object.keys(localErrors).length) {
      Object.entries(localErrors).forEach(([k, v]) => setFieldError(k, v));
      return focusFirstError();
    }

    setLoading(true);
    try {
      const res = await getJson('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) return showSuccess(res.body);

      const error = res.body.error ?? {};
      if (res.status === 422 && error.fields) {
        Object.entries(error.fields).forEach(([k, v]) => setFieldError(k, v));
        focusFirstError();
      } else if (res.status === 409 && error.dates) {
        error.dates.forEach((d) => state.booked.add(d));
        state.selected = state.selected.filter((d) => !error.dates.includes(d));
        renderCalendar();
        setFieldError('dates', `Sorry, ${error.dates.map(shortDate).join(' and ')} just got booked. Please pick another date.`);
        focusFirstError();
      } else {
        showFormError(error.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      showFormError('We could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  });

  function showSuccess({ whatsappUrl, message }) {
    els.preview.textContent = message;
    els.waLink.href = whatsappUrl;
    form.hidden = true;
    els.success.hidden = false;
    els.success.focus();
  }

  els.edit.addEventListener('click', () => {
    els.success.hidden = true;
    form.hidden = false;
    els.submit.focus();
  });

  init();
})();
