// Served at /embed.js for other sites:
//
//   <div data-open-form="meetup"></div>
//   <script src="https://forms.example.com/embed.js" async></script>
//
// Each element becomes an iframe of /f/<id>?embed that grows with the form.
// Optional attributes: data-open-form-lang="ja", data-open-form-title="Meetup".
// The element fires `open-form:submitted` (bubbling) after a response is sent.
// Allow the embedding site with `embed.origins` in open-form.config.ts.
(() => {
  const script = document.currentScript;
  if (!script || window.OpenForm) return;
  const origin = new URL(script.src).origin;

  function mount(element, id) {
    if (id) element.setAttribute('data-open-form', id);
    const formId = element.getAttribute('data-open-form');
    if (!formId || element.querySelector('iframe[data-open-form-frame]')) return;
    const url = new URL(`/f/${encodeURIComponent(formId)}`, origin);
    url.searchParams.set('embed', '');
    const lang = element.getAttribute('data-open-form-lang');
    if (lang) url.searchParams.set('lang', lang);
    const frame = document.createElement('iframe');
    frame.src = url.href;
    frame.title = element.getAttribute('data-open-form-title') || formId;
    frame.loading = 'lazy';
    frame.setAttribute('data-open-form-frame', '');
    frame.style.cssText = 'display:block;width:100%;height:480px;border:0;color-scheme:normal';
    element.replaceChildren(frame);
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== origin || !event.data || typeof event.data !== 'object') return;
    for (const frame of document.querySelectorAll('iframe[data-open-form-frame]')) {
      if (frame.contentWindow !== event.source) continue;
      const { type, height, formId } = event.data;
      if (type === 'open-form:resize' && typeof height === 'number' && height > 0) {
        frame.style.height = `${Math.ceil(height)}px`;
      } else if (type === 'open-form:submitted') {
        frame.parentElement?.dispatchEvent(
          new CustomEvent('open-form:submitted', { bubbles: true, detail: { formId } }),
        );
      }
    }
  });

  const scan = () => {
    for (const element of document.querySelectorAll('[data-open-form]')) mount(element);
  };
  window.OpenForm = { mount };
  scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
})();
