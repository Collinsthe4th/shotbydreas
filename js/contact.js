// Contact page: "Leave a message" form. Sends to /api/contact, which emails Dreas's Gmail.
// If sending fails, the visitor gets a WhatsApp link with their message filled in.

(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const number = form.dataset.wa;
  const button = form.querySelector('[type="submit"]');
  const label = button.querySelector('.submit-label');
  const status = document.getElementById('contact-status');
  const success = document.getElementById('contact-success');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const setError = (name, message) => {
    const el = form.querySelector(`[data-error-for="${name}"]`);
    const input = form.elements[name];
    if (!el || !input) return;
    el.textContent = message;
    el.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };

  const values = () => ({
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    subject: form.elements.subject.value.trim(),
    message: form.elements.message.value.trim(),
    website: form.elements.website.value,
  });

  function validate(v) {
    const errors = {
      name: v.name.length < 2 ? 'Enter your name.' : '',
      email: !v.email ? 'Enter your email so Dreas can reply.' : EMAIL_RE.test(v.email) ? '' : 'Check your email address.',
      message: v.message.length < 5 ? 'Write a short message.' : '',
    };
    Object.entries(errors).forEach(([k, m]) => setError(k, m));
    const first = Object.keys(errors).find((k) => errors[k]);
    if (first) form.elements[first].focus();
    return !first;
  }

  function whatsappLink(v) {
    const lines = [`Hello Dreas, this is ${v.name}.`];
    if (v.subject) lines.push(`Subject: ${v.subject}`);
    lines.push('', v.message, '', `Email: ${v.email}`);
    return `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`;
  }

  function showStatus(message, v) {
    status.innerHTML = '';
    status.append(message + ' ');
    if (v && number) {
      const a = Object.assign(document.createElement('a'), { href: whatsappLink(v), target: '_blank', rel: 'noopener', textContent: 'Send it on WhatsApp instead' });
      status.append(a, '.');
    }
    status.hidden = false;
  }

  const setBusy = (busy) => {
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    label.textContent = busy ? 'Sending...' : 'Send message';
  };

  form.addEventListener('input', (e) => {
    if (form.querySelector(`[data-error-for="${e.target.name}"]`)) setError(e.target.name, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.hidden = true;
    const v = values();
    if (!validate(v)) return;

    setBusy(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        form.hidden = true;
        success.hidden = false;
        success.focus();
        if (window.SBDUI?.motionOk()) gsap.from(success.children, { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
        return;
      }
      const error = body.error ?? {};
      if (res.status === 422 && error.fields) {
        Object.entries(error.fields).forEach(([k, m]) => setError(k, m));
        const first = Object.keys(error.fields)[0];
        form.elements[first]?.focus();
      } else {
        showStatus(error.message ?? 'Your message could not be sent.', v);
      }
    } catch {
      showStatus('We could not reach the server. Check your connection and try again.', v);
    } finally {
      setBusy(false);
    }
  });

  document.getElementById('contact-again')?.addEventListener('click', () => {
    form.reset();
    success.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  });
})();
