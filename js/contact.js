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

  form.addEventListener('input', (e) => e.target.name && setError(e.target.name, ''));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    const message = form.elements.message.value.trim();
    setError('name', name.length < 2 ? 'Enter your name.' : '');
    setError('message', message.length < 5 ? 'Write a short message.' : '');
    if (name.length < 2) return form.elements.name.focus();
    if (message.length < 5) return form.elements.message.focus();

    const text = `Hello Dreas, this is ${name}.\n\n${message}`;
    const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
    const done = form.querySelector('[data-sent]');
    done.hidden = false;
    done.querySelector('a').href = url;
  });
})();
