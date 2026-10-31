/* Shared navigation and grounding interactions. Works on every page. */
(() => {
  'use strict';
  const menuToggle = document.getElementById('menuToggle');
  const primaryNav = document.getElementById('primaryNav');
  const serviceToggle = document.querySelector('.dropdown-toggle');
  const serviceItem = serviceToggle?.closest('.has-dropdown');

  // Dropdowns are controlled explicitly rather than using :hover / :focus-within.
  // This works consistently for mouse, keyboard, touch, and file:// previews.
  function closeServices(returnFocus = false) {
    const wasOpen = serviceItem?.classList.contains('dropdown-open');
    serviceItem?.classList.remove('dropdown-open');
    serviceToggle?.setAttribute('aria-expanded', 'false');
    if (returnFocus && wasOpen) serviceToggle?.focus();
  }
  function closeMenu(returnFocus = false) {
    const wasOpen = primaryNav?.classList.contains('open');
    primaryNav?.classList.remove('open');
    menuToggle?.classList.remove('active');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'Open navigation menu');
    closeServices();
    if (returnFocus && wasOpen) menuToggle?.focus();
  }
  menuToggle?.addEventListener('click', () => {
    const open = primaryNav.classList.toggle('open');
    menuToggle.classList.toggle('active', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    if (!open) closeServices();
  });
  serviceToggle?.addEventListener('click', () => {
    const open = serviceItem.classList.toggle('dropdown-open');
    serviceToggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (serviceItem?.classList.contains('dropdown-open')) {
      closeServices(true);
    } else if (primaryNav?.classList.contains('open')) {
      closeMenu(true);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!serviceItem?.contains(event.target)) closeServices();
    if (!event.target.closest('.site-header')) closeMenu();
  });
  document.querySelectorAll('#primaryNav a').forEach(link => link.addEventListener('click', () => closeMenu()));
  const desktopQuery = window.matchMedia('(min-width: 769px)');
  desktopQuery.addEventListener('change', () => closeMenu());

  const next = document.getElementById('groundingNext');
  const previous = document.getElementById('groundingPrevious');
  const reset = document.getElementById('groundingReset');
  const stepText = document.getElementById('grounding-step');
  const progressText = document.getElementById('grounding-progress');
  if (next && previous && reset && stepText && progressText) {
    const steps = [
      'Notice <strong>5 things you can see</strong> around you.',
      'Notice <strong>4 things you can feel</strong>, such as your feet on the floor.',
      'Notice <strong>3 things you can hear</strong>, near or far.',
      'Notice <strong>2 things you can smell</strong>, or two scents you remember.',
      'Notice <strong>1 thing you can taste</strong>, or simply notice your breathing.'
    ];
    let index = 0;
    function render() {
      const complete = index === steps.length;
      stepText.innerHTML = complete ? '<strong>You have finished.</strong> Return to your day when you feel ready.' : steps[index];
      progressText.textContent = complete ? 'Exercise complete' : `Step ${index + 1} of ${steps.length}`;
      previous.disabled = index === 0;
      next.disabled = complete;
      next.textContent = index === steps.length - 1 ? 'Finish' : 'Next step';
      stepText.focus({preventScroll: true});
    }
    next.addEventListener('click', () => { index = Math.min(steps.length, index + 1); render(); });
    previous.addEventListener('click', () => { index = Math.max(0, index - 1); render(); });
    reset.addEventListener('click', () => { index = 0; render(); });
  }
})();
