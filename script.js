(function () {
  'use strict';

  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('main-nav');

  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    navigation.classList.remove('is-open');
  }

  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    navigation.classList.toggle('is-open', open);
  });
  navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
      closeMenu(); menuButton.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  window.matchMedia('(min-width: 651px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  const toast = document.getElementById('toast');
  let toastTimer;
  function notify(message) {
    toast.textContent = message; toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  async function copyColour(value) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(value); return; }
      catch (_) { /* A local file may need the selection-based fallback. */ }
    }
    const previousFocus = document.activeElement;
    const input = document.createElement('textarea');
    input.value = value; input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(input); input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); }
    finally { input.remove(); previousFocus.focus({ preventScroll: true }); }
    if (!copied) throw new Error('Clipboard unavailable');
  }
  document.querySelectorAll('[data-color]').forEach(button => {
    button.addEventListener('click', async () => {
      try { await copyColour(button.dataset.color); notify(button.dataset.color + ' copied. A little colour to take with you.'); }
      catch (_) { notify('Your colour is ' + button.dataset.color + '. Select the HEX code to copy it manually.'); }
    });
  });

  const filters = document.querySelectorAll('[data-filter]');
  const products = document.querySelectorAll('.product-card');
  filters.forEach(button => {
    button.addEventListener('click', () => {
      filters.forEach(filter => {
        const active = filter === button;
        filter.classList.toggle('active', active); filter.setAttribute('aria-pressed', String(active));
      });
      let count = 0;
      products.forEach(product => {
        product.hidden = button.dataset.filter !== 'all' && product.dataset.category !== button.dataset.filter;
        if (!product.hidden) count++;
      });
      document.getElementById('collection-status').textContent = 'Showing ' + count + ' collection concept' + (count === 1 ? '.' : 's.');
    });
  });

  const details = {
    journal: { title: 'The Everyday Journal', category: '01 / PEN & PAPER', image: 'journal-art', alt: 'Cream linen journal with Room to Bloom lettering and a yellow bird', description: 'For the thoughts you’re still figuring out, the plans taking shape, and the small things you don’t want to forget. A cream cover, a little yellow bird, and plenty of possibility.' },
    mug: { title: 'The Slow Morning Mug', category: '02 / EVERYDAY COMFORTS', image: 'mug-art', alt: 'Warm white ceramic mug with a little yellow bird and botanical artwork', description: 'A quiet companion for that first cup, an afternoon pause, or a moment all to yourself. A cheerful little bird brings a touch of sunshine to an ordinary ritual.' },
    sweatshirt: { title: 'The Growing Season Sweatshirt', category: '03 / EVERYDAY COMFORTS', image: 'sweatshirt-art', alt: 'Folded sage sweatshirt with cream Room to Bloom lettering and a yellow bird', description: 'Wear a little encouragement. Garden sage, a gentle wordmark, and our signature bird come together in an everyday piece that makes room for wherever you are in your growing season.' },
    gift: { title: 'The Little Joy Gift Box', category: '04 / THOUGHTFUL GIFTS', image: 'gift-art', alt: 'Blush gift box with an ivory ribbon and a yellow bird gift tag', description: 'For a fresh start, a thoughtful thank-you, or no particular reason at all. Blush paper, a soft ribbon, and a little bird make the outside feel as considered as the thought behind it.' }
  };
  const dialog = document.getElementById('product-dialog');
  let opener;

  document.querySelectorAll('[data-product]').forEach(button => {
    button.addEventListener('click', () => {
      const product = details[button.dataset.product];
      if (!product) return;
      opener = button;
      document.getElementById('dialog-title').textContent = product.title;
      document.getElementById('dialog-category').textContent = product.category;
      document.getElementById('dialog-description').textContent = product.description;
      const image = document.getElementById('dialog-image');
      image.className = 'dialog-product-image ' + product.image;
      image.setAttribute('aria-label', product.alt);
      dialog.showModal(); document.body.classList.add('dialog-open');
    });
  });
  function restoreProductFocus() {
    if (dialog.open) return;
    document.body.classList.remove('dialog-open');
    if (opener) opener.focus({ preventScroll: true });
  }
  function closeProduct() { dialog.close(); restoreProductFocus(); }
  document.querySelector('.dialog-close').addEventListener('click', closeProduct);
  document.querySelector('.dialog-return').addEventListener('click', closeProduct);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeProduct();
  });
  dialog.addEventListener('close', restoreProductFocus);
})();
