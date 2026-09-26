// Contact page: a quick-question form that opens WhatsApp with the message filled in.
// No server needed. The number comes from the form's data-wa attribute.

(() => {
  const form = document.getElementById('quick-form');
  if (!form) return;
  const number = form.dataset.wa;

  const setError = (name, message) => {
    const el = form.querySelector(`[data-error-for="${name}"]`);
    const input = form.elements[name];
    el.textContent = message;
    el.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };

  form.addEventListener('input', (e) => {
    const n = e.target.name;
    if (form.querySelector(`[data-error-for="${n}"]`)) setError(n, '');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const subject = form.elements.subject.value.trim();
    const message = form.elements.message.value.trim();
    const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setError('name', name.length < 2 ? 'Enter your name.' : '');
    setError('email', emailOk ? '' : 'Check your email address, or leave it empty.');
    setError('message', message.length < 5 ? 'Write a short message.' : '');
    if (name.length < 2) return form.elements.name.focus();
    if (!emailOk) return form.elements.email.focus();
    if (message.length < 5) return form.elements.message.focus();

    const lines = [`Hello Dreas, this is ${name}.`];
    if (subject) lines.push(`Subject: ${subject}`);
    lines.push('', message);
    if (email) lines.push('', `Email: ${email}`);
    const text = lines.join('\n');
    const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
    const done = form.querySelector('[data-sent]');
    done.hidden = false;
    done.querySelector('a').href = url;
  });
})();
