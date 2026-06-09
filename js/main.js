/* ZenTechServices — Main JS */

(function () {
  'use strict';

  /* --- Sticky nav shadow --- */
  const header = document.querySelector('.nav-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --- Mobile nav toggle --- */
  const toggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    /* Close on link click */
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        toggle.classList.remove('open');
        document.body.style.overflow = '';
      });
    });

    /* Close on resize to desktop */
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        mobileNav.classList.remove('open');
        toggle.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* --- Active nav link --- */
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* --- Contact form — submit via Cloudflare Pages Function --- */
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const btn     = form.querySelector('button[type="submit"]');
      const origHTML = btn.innerHTML;

      // Client-side validation
      const requiredFields = ['fname', 'email', 'service', 'message'];
      let firstInvalid = null;
      requiredFields.forEach(name => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el && !el.value.trim() && !firstInvalid) firstInvalid = el;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      // Loading state
      btn.disabled = true;
      btn.innerHTML = 'Sending…';

      // Clear any previous error
      const prevErr = form.querySelector('.form-error');
      if (prevErr) prevErr.remove();

      try {
        const res = await fetch('/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fname:    form.fname.value.trim(),
            lname:    (form.lname   ? form.lname.value.trim()   : ''),
            email:    form.email.value.trim(),
            company:  (form.company  ? form.company.value.trim()  : ''),
            service:  form.service.value,
            timeline: (form.timeline ? form.timeline.value        : ''),
            message:  form.message.value.trim(),
          }),
        });

        if (res.ok) {
          // Replace form content with success message
          form.innerHTML = `
            <div style="text-align:center;padding:48px 24px;">
              <div style="width:56px;height:56px;background:var(--c-green-bg);
                          border-radius:50%;display:flex;align-items:center;
                          justify-content:center;margin:0 auto 20px;">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                     stroke="var(--c-green)" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3 style="margin-bottom:8px;">Message sent</h3>
              <p style="color:var(--c-ink-3);font-size:0.9rem;max-width:320px;margin:0 auto;">
                We'll review your message and be in touch within one business day.
              </p>
            </div>`;
        } else {
          throw new Error('Server returned ' + res.status);
        }
      } catch (err) {
        // Restore button
        btn.disabled = false;
        btn.innerHTML = origHTML;

        // Show inline error below the button
        const errEl = document.createElement('p');
        errEl.className = 'form-error';
        errEl.style.cssText = 'color:#dc2626;font-size:0.85rem;margin-top:12px;text-align:center;';
        errEl.textContent = 'Something went wrong — please try again or email us at info@zentalence.com.';
        btn.insertAdjacentElement('afterend', errEl);
      }
    });
  }

})();
