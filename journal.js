(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const gate = $('journal-gate');
  const pages = $('journal-pages');
  const openButton = $('open-journal');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = [
    { id: 'title-page', number: 'Ⅰ', title: 'Title page', quote: 'There’s room\nfor you here.' },
    { id: 'story', number: '01', title: 'Our story', quote: 'Grow gently.\nAt your own pace.' },
    { id: 'brand', number: '02', title: 'The brand world', quote: 'Little details.\nA familiar feeling.' },
    { id: 'palette', number: '03', title: 'Our colours', quote: 'Borrow a little\nsunshine.' },
    { id: 'collection', number: '04', title: 'The everyday collection', quote: 'Make room\nfor little joys.' },
    { id: 'contents', number: '05', title: 'The last page', quote: 'Every season.\nA new beginning.' }
  ];
  let state = 'closed', currentPage = 0, openingTimer;
  let layoutFrame = 0, printingLayout = false;

  function fitElement(element, container) {
    if (!element || !container || element.hidden || !container.clientHeight) return;
    const style = getComputedStyle(container);
    const left = parseFloat(style.paddingLeft) || 0;
    const right = parseFloat(style.paddingRight) || 0;
    const top = parseFloat(style.paddingTop) || 0;
    const bottom = parseFloat(style.paddingBottom) || 0;
    const width = container.clientWidth - left - right;
    const height = container.clientHeight - top - bottom;
    if (width <= 0 || height <= 0) return;
    element.style.position = 'absolute';
    element.style.width = width + 'px';
    element.style.height = 'auto';
    element.style.margin = '0';
    element.style.left = left + 'px';
    element.style.top = top + 'px';
    element.style.transform = 'none';
    element.style.transformOrigin = 'top left';
    const contentWidth = Math.max(width, element.scrollWidth);
    const contentHeight = Math.max(1, element.offsetHeight, element.scrollHeight);
    const scale = Math.min(1, width / contentWidth, Math.max(1, height - 1) / contentHeight);
    element.style.left = left + Math.max(0, (width - contentWidth * scale) / 2) + 'px';
    element.style.transform = 'scale(' + scale + ')';
  }

  function fitCover() {
    const desk = document.querySelector('.journal-desk');
    const cover = document.querySelector('.closed-journal');
    if (!desk.clientHeight || !cover.offsetHeight) return;
    const scale = Math.min(1, Math.max(1, desk.clientHeight - 24) / (cover.offsetHeight + 85), Math.max(1, desk.clientWidth - 50) / (cover.offsetWidth + 24));
    cover.style.transform = 'translate(-50%,-50%) scale(' + scale + ')';
  }

  function fitLayout() {
    if (printingLayout) return;
    if (state === 'closed') { fitCover(); return; }
    if (state !== 'open') return;
    fitElement($(chapters[currentPage].id), $('leaf-viewport'));
    const margin = document.querySelector('.journal-margin');
    if (margin.clientHeight) fitElement(document.querySelector('.margin-sticky'), margin);
  }

  function requestFit() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(fitLayout);
  }

  function showPage(index, options = {}) {
    if (index < 0 || index >= chapters.length) return;
    currentPage = index;
    chapters.forEach((chapter, position) => {
      const leaf = $(chapter.id);
      leaf.hidden = position !== index;
      leaf.classList.remove('leaf-arriving');
    });
    const active = $(chapters[index].id);
    if (!motion.matches && options.animate !== false) {
      active.getBoundingClientRect();
      active.classList.add('leaf-arriving');
    }
    document.querySelectorAll('[data-page-target]').forEach(control => {
      if (control.dataset.pageTarget === chapters[index].id) control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
    });
    $('margin-quote').textContent = chapters[index].quote;
    $('leaf-folio').textContent = 'PAGE ' + String(index + 1).padStart(2, '0') + ' / ' + String(chapters.length).padStart(2, '0');
    $('page-prev').hidden = index === 0;
    $('title-next').hidden = index !== 0;
    $('page-next').hidden = index === 0;
    $('page-next').disabled = index === chapters.length - 1;
    $('prev-bud-number').textContent = chapters[Math.max(0, index - 1)].number;
    $('next-bud-number').textContent = chapters[Math.min(chapters.length - 1, index + 1)].number;
    $('page-prev').setAttribute('aria-label', 'Previous page: ' + chapters[Math.max(0, index - 1)].title);
    $('page-next').setAttribute('aria-label', index === chapters.length - 1 ? 'The final page' : 'Next page: ' + chapters[index + 1].title);
    fitLayout();
    if (options.focus !== false) active.focus({ preventScroll: true });
    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  chapters.forEach(chapter => $(chapter.id).addEventListener('animationend', () => $(chapter.id).classList.remove('leaf-arriving')));

  function finishOpening() {
    if (state !== 'opening') return;
    clearTimeout(openingTimer);
    state = 'open';
    gate.hidden = true; gate.inert = true;
    pages.inert = false;
    document.body.classList.remove('journal-closed', 'journal-opening');
    document.body.classList.add('journal-open');
    showPage(0, { animate: false });
  }
  function openJournal() {
    if (state !== 'closed') return;
    state = 'opening';
    pages.hidden = false; pages.inert = true;
    openButton.disabled = true;
    document.body.classList.remove('journal-closed');
    document.body.classList.add('journal-opening');
    if (motion.matches) { finishOpening(); return; }
    $('cover-hinge').getBoundingClientRect();
    gate.classList.add('is-opening');
    openingTimer = setTimeout(finishOpening, 1400);
  }
  function closeJournal() {
    clearTimeout(openingTimer);
    if ($('product-dialog').open) $('product-dialog').close();
    state = 'closed';
    pages.hidden = true; pages.inert = true;
    gate.hidden = false; gate.inert = false;
    gate.classList.remove('is-opening'); gate.scrollTop = 0;
    openButton.disabled = false;
    document.body.classList.remove('journal-open', 'journal-opening', 'dialog-open');
    document.body.classList.add('journal-closed');
    window.scrollTo({ top: 0, behavior: 'instant' });
    openButton.focus({ preventScroll: true });
    fitCover();
  }
  openButton.addEventListener('click', openJournal);
  $('close-journal').addEventListener('click', closeJournal);
  $('cover-hinge').addEventListener('transitionend', event => {
    if (event.target === $('cover-hinge') && event.propertyName === 'transform') finishOpening();
  });
  motion.addEventListener('change', () => { if (state === 'opening' && motion.matches) finishOpening(); });

  document.querySelectorAll('[data-page-target]').forEach(control => {
    control.addEventListener('click', event => {
      event.preventDefault();
      if (state !== 'open') return;
      const index = chapters.findIndex(chapter => chapter.id === control.dataset.pageTarget);
      if (index < 0) return;
      showPage(index);
      if (control.hasAttribute('data-contents-link')) $('contents-title').focus({ preventScroll: true });
    });
  });
  $('title-next').addEventListener('click', () => { if (state === 'open') showPage(1); });
  $('page-prev').addEventListener('click', () => { if (state === 'open') showPage(currentPage - 1); });
  $('page-next').addEventListener('click', () => { if (state === 'open') showPage(currentPage + 1); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state === 'opening') { closeJournal(); return; }
    if (state !== 'open' || $('product-dialog').open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,button,a,select,[contenteditable]')) return;
    if (event.key === 'ArrowRight' && currentPage < chapters.length - 1) { event.preventDefault(); showPage(currentPage + 1); }
    if (event.key === 'ArrowLeft' && currentPage > 0) { event.preventDefault(); showPage(currentPage - 1); }
  });

  const noteKey = 'room-to-bloom-journal.personal-note.v1';
  try {
    const saved = JSON.parse(window.localStorage.getItem(noteKey) || 'null');
    if (saved && typeof saved.owner === 'string') $('journal-owner').value = saved.owner.slice(0, 80);
    if (saved && typeof saved.note === 'string') $('journal-note').value = saved.note.slice(0, 1200);
    if ($('journal-owner').value || $('journal-note').value) $('note-status').textContent = 'Your words, waiting here for you. Saved on this device.';
  } catch (_) { /* The journal remains writable when local storage is unavailable. */ }
  let saveTimer;
  function saveNote() {
    try {
      window.localStorage.setItem(noteKey, JSON.stringify({ owner: $('journal-owner').value, note: $('journal-note').value }));
      $('note-status').textContent = 'Your little note is saved on this device.';
    } catch (_) { $('note-status').textContent = 'Your note stays in this open tab. This browser could not save it for later.'; }
  }
  for (const id of ['journal-owner', 'journal-note']) {
    $(id).addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveNote, 200); });
    $(id).addEventListener('change', () => { clearTimeout(saveTimer); saveNote(); });
  }
  window.addEventListener('pagehide', () => { if (saveTimer) { clearTimeout(saveTimer); saveNote(); } });

  let toastTimer;
  function notify(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }
  async function copyColour(value) {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(value); return; }
      catch (_) { /* Try a local-file-compatible selection below. */ }
    }
    const previous = document.activeElement, input = document.createElement('textarea');
    input.value = value; input.readOnly = true;
    input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(input); input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); }
    finally { input.remove(); previous.focus({ preventScroll: true }); }
    if (!copied) throw new Error('Clipboard unavailable');
  }
  document.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', async () => {
    try { await copyColour(button.dataset.color); notify(button.dataset.color + ' copied. A little colour to take with you.'); }
    catch (_) { notify('Your colour is ' + button.dataset.color + '. Select the HEX code to copy it manually.'); }
  }));

  const filters = document.querySelectorAll('[data-filter]');
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(filter => {
      filter.classList.toggle('active', filter === button);
      filter.setAttribute('aria-pressed', String(filter === button));
    });
    let count = 0;
    document.querySelectorAll('.product-card').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
      if (!card.hidden) count++;
    });
    $('collection-status').textContent = 'Showing ' + count + ' collection concept' + (count === 1 ? '.' : 's.');
    requestFit();
  }));

  const details = {
    journal: { title: 'The Everyday Journal', category: 'PEN & PAPER', image: 'journal-art', alt: 'A cream linen Room to Bloom journal with canary and botanical artwork', description: 'For thoughts taking shape, plans still growing, and small things worth remembering. A little space to make your own.' },
    mug: { title: 'The Slow Morning Mug', category: 'EVERYDAY COMFORTS', image: 'mug-art', alt: 'A cream ceramic mug with a golden canary on a botanical sprig', description: 'A quiet companion for that first cup, an afternoon pause, or a moment all to yourself. A little sunshine in an ordinary ritual.' },
    sweatshirt: { title: 'The Growing Season Sweatshirt', category: 'EVERYDAY COMFORTS', image: 'sweatshirt-art', alt: 'A folded sage sweatshirt with the Room to Bloom wordmark and bird', description: 'Garden sage, a gentle wordmark, and our signature canary. A little encouragement to carry into your own growing season.' },
    gift: { title: 'The Little Joy Gift Box', category: 'THOUGHTFUL GIFTS', image: 'gift-art', alt: 'A blush gift box with an ivory ribbon and canary gift tag', description: 'For a fresh start, a thoughtful thank-you, or no particular reason at all. A considered little way to say: there’s room for you here.' },
    frame: { title: 'The Little Moments Frame', category: 'KEEPSAKES FOR HOME', image: 'frame-art', alt: 'A pale wooden photo frame with the canary logo, Room to Bloom name and Embrace and Grow Through Every Season tagline', description: 'A frame for moments you want to keep close. A warm wooden surround, a cream mat, our golden canary and the reminder: Embrace and Grow Through Every Season.' },
    jewellery: { title: 'The Treasured Things Box', category: 'THOUGHTFUL GIFTS', image: 'jewellery-art', alt: 'An open blush jewellery box with velvet compartments and a canary logo on its lid', description: 'A soft little home for precious things. Blush fabric, cream compartments and the Room to Bloom signature make a keepsake of the box itself.' },
    vase: { title: 'The Peony Pause Vase', category: 'LITTLE THINGS FOR HOME', image: 'vase-art', alt: 'A small cream ceramic vase with a canary mark and a few blush peonies', description: 'A small vase, a few peony stems, a softer corner of your day. Our little canary sits quietly beneath a gentle arrangement of blush petals.' },
    tshirt: { title: 'The Everyday Bloom Tee', category: 'EVERYDAY COMFORTS', image: 'tshirt-art', alt: 'A fully unfolded cream T-shirt with both short sleeves visible, a yellow canary and the Room to Bloom logo', description: 'A little sunshine to take with you. A cream tee, an upright wordmark and our golden canary turn a familiar everyday piece into a gentle reminder to grow.' }
  };
  const dialog = $('product-dialog');
  let productOpener;
  document.querySelectorAll('[data-product]').forEach(button => button.addEventListener('click', () => {
    const product = details[button.dataset.product];
    if (!product) return;
    productOpener = button;
    $('dialog-title').textContent = product.title;
    $('dialog-category').textContent = product.category;
    $('dialog-description').textContent = product.description;
    $('dialog-image').className = 'dialog-product-image ' + product.image;
    $('dialog-image').setAttribute('aria-label', product.alt);
    dialog.showModal(); document.body.classList.add('dialog-open');
  }));
  function restoreProductFocus() {
    if (dialog.open) return;
    document.body.classList.remove('dialog-open');
    if (productOpener && !productOpener.closest('[hidden]')) productOpener.focus({ preventScroll: true });
  }
  function closeProduct() { dialog.close(); restoreProductFocus(); }
  document.querySelector('.dialog-close').addEventListener('click', closeProduct);
  document.querySelector('.dialog-return').addEventListener('click', closeProduct);
  dialog.addEventListener('close', restoreProductFocus);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeProduct();
  });

  let printSnapshot;
  window.addEventListener('beforeprint', () => {
    printingLayout = true;
    printSnapshot = { hidden: pages.hidden, inert: pages.inert, leaves: chapters.map(chapter => $(chapter.id).hidden) };
    pages.hidden = false; pages.inert = false;
    chapters.forEach(chapter => {
      const leaf = $(chapter.id);
      leaf.hidden = false;
      for (const property of ['position', 'width', 'height', 'margin', 'left', 'top', 'transform', 'transform-origin']) leaf.style.removeProperty(property);
    });
  });
  window.addEventListener('afterprint', () => {
    if (!printSnapshot) return;
    pages.hidden = printSnapshot.hidden; pages.inert = printSnapshot.inert;
    chapters.forEach((chapter, index) => { $(chapter.id).hidden = printSnapshot.leaves[index]; });
    printSnapshot = undefined;
    printingLayout = false;
    requestFit();
  });
  showPage(0, { focus: false, scroll: false, animate: false });
  window.addEventListener('resize', () => { fitLayout(); requestFit(); });
  window.addEventListener('load', requestFit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', requestFit);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(requestFit);
    observer.observe($('leaf-viewport'));
    observer.observe(document.querySelector('.journal-desk'));
  }
  document.querySelectorAll('img').forEach(image => image.addEventListener('load', requestFit));
  fitCover();
})();
