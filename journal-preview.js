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
  const classic = document.body.classList.contains('format-classic');
  const narrowSpread = window.matchMedia('(max-width: 700px)');
  let currentSide = 0;

  function makeSheet(nodes, side) {
    const sheet = document.createElement('div');
    sheet.className = 'spread-sheet sheet-' + side;
    const inner = document.createElement('div');
    inner.className = 'sheet-inner';
    nodes.filter(Boolean).forEach(node => inner.append(node));
    sheet.append(inner);
    return sheet;
  }
  function splitChapter(id, left, right) {
    const chapter = $(id);
    chapter.replaceChildren(makeSheet(left, 'left'), makeSheet(right, 'right'));
  }
  if (classic) {
    const title = $('title-page');
    splitChapter('title-page', [title.querySelector('.title-page-art'), title.querySelector('.title-dedication')], [title.querySelector('.personal-note')]);
    const story = $('story');
    splitChapter('story', [story.querySelector('.section-index'), $('story-title'), story.querySelector('.story-copy')], [story.querySelector('.story-photo'), story.querySelector('blockquote')]);
    const brand = $('brand');
    splitChapter('brand', [brand.querySelector('.section-index'), $('brand-title'), brand.querySelector('.leaf-description'), brand.querySelector('.bird-tile')], [brand.querySelector('.botanical-tile'), brand.querySelector('.wordmark-tile'), brand.querySelector('.pencil-brand-note')]);
    const palette = $('palette');
    splitChapter('palette', [palette.querySelector('.section-index'), $('palette-title'), palette.querySelector('.leaf-description'), palette.querySelector('.colour-notes'), palette.querySelector('.palette-botanical')], [palette.querySelector('.palette-board')]);
    const collection = $('collection');
    const products = collection.querySelector('.product-grid');
    const continued = document.createElement('div');
    continued.className = 'product-grid';
    Array.from(products.children).slice(4).forEach(card => continued.append(card));
    splitChapter('collection', [collection.querySelector('.section-index'), $('collection-title'), collection.querySelector('.leaf-description'), collection.querySelector('.collection-toolbar'), products], [continued, $('collection-status'), collection.querySelector('.collection-note')]);
    const contents = $('contents');
    splitChapter('contents', [contents.querySelector('.collection-closing')], [contents.querySelector('.table-of-contents')]);
    document.querySelector('.journal-margin').hidden = true;
    $('contents-title').nextElementSibling.textContent = 'SPREAD';
  }

  function fitClassic() {
    const active = $(chapters[currentPage].id);
    active.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;transform:none';
    active.querySelectorAll('.spread-sheet').forEach(sheet => fitElement(sheet.firstElementChild, sheet));
    if (currentPage === 4 && !narrowSpread.matches) {
      const sheets = [...active.querySelectorAll('.spread-sheet')];
      const scale = Math.min(...sheets.map(sheet => new DOMMatrix(getComputedStyle(sheet.firstElementChild).transform).a));
      sheets.forEach(sheet => fitElement(sheet.firstElementChild, sheet, scale));
    }
    syncClassicNavigation();
  }
  function loadPageImages(active) {
    active.querySelectorAll('img[data-src]').forEach(image => {
      const sheet = image.closest('.spread-sheet');
      if (sheet && !sheet.clientHeight) return;
      image.loading = 'eager';
      image.fetchPriority = 'auto';
      image.src = image.dataset.src;
      delete image.dataset.src;
    });
  }
  function syncClassicNavigation() {
    const mobile = narrowSpread.matches;
    $('leaf-folio').textContent = mobile
      ? 'PAGE ' + String(currentPage * 2 + currentSide + 1).padStart(2, '0') + ' / 12'
      : 'SPREAD ' + String(currentPage + 1).padStart(2, '0') + ' / 06';
    const atStart = currentPage === 0 && (!mobile || currentSide === 0);
    const atEnd = currentPage === chapters.length - 1 && (!mobile || currentSide === 1);
    $('page-prev').hidden = atStart;
    $('page-next').disabled = atEnd;
    const nextChapter = mobile && currentSide === 0 ? currentPage : Math.min(chapters.length - 1, currentPage + 1);
    const prevChapter = mobile && currentSide === 1 ? currentPage : Math.max(0, currentPage - 1);
    $('next-bud-number').textContent = chapters[nextChapter].number;
    $('prev-bud-number').textContent = chapters[prevChapter].number;
    $('page-prev').setAttribute('aria-label', 'Previous page: ' + chapters[prevChapter].title);
    $('page-next').setAttribute('aria-label', atEnd ? 'The final page' : 'Next page: ' + chapters[nextChapter].title);
    const titleText = $('title-next').querySelector('span');
    titleText.innerHTML = (mobile && currentSide === 0 ? 'Make it yours' : 'Begin your story') + ' <span aria-hidden="true">→</span>';
    $('title-next').setAttribute('aria-label', mobile && currentSide === 0 ? 'Turn to your personal note' : 'Turn to 01, Our story');
  }
  function turnPage(direction) {
    if (state !== 'open') return;
    if (classic && narrowSpread.matches) {
      if (direction === 1 && currentSide === 0) showPage(currentPage, { side: 1 });
      else if (direction === -1 && currentSide === 1) showPage(currentPage, { side: 0 });
      else showPage(currentPage + direction, { side: direction === -1 ? 1 : 0 });
    } else showPage(currentPage + direction);
  }

  let state = 'closed', currentPage = 0, openingTimer, openingFocus = true;
  let layoutFrame = 0, printingLayout = false;
  let pageOverlay, pageAnimations = [], pageTransition = 0;

  function clearPageTransition() {
    pageTransition++;
    pageAnimations.forEach(animation => animation.cancel());
    pageAnimations = [];
    if (pageOverlay) pageOverlay.remove();
    pageOverlay = undefined;
  }

  function capturePage(leaf, side, opacity) {
    const copy = leaf.cloneNode(true);
    // Freeze ID-specific typography and the three-line note before removing IDs.
    // The temporary visual copy is inert and never duplicates document targets.
    const originals = leaf.querySelectorAll('[id]');
    const copies = copy.querySelectorAll('[id]');
    originals.forEach((element, index) => {
      const style = getComputedStyle(element);
      for (const property of style) copies[index].style.setProperty(property, style.getPropertyValue(property));
    });
    const fields = leaf.querySelectorAll('input,textarea');
    copy.querySelectorAll('input,textarea').forEach((field, index) => { field.value = fields[index].value; });
    [copy, ...copy.querySelectorAll('[id],[tabindex],[name],[autofocus]')].forEach(element => {
      for (const attribute of ['id', 'tabindex', 'name', 'autofocus', 'data-leaf']) element.removeAttribute(attribute);
    });
    copy.classList.remove('leaf-arriving');
    copy.style.translate = getComputedStyle(leaf).translate;
    const overlay = document.createElement('div');
    overlay.className = 'page-transition-layer';
    overlay.dataset.side = String(side);
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;
    overlay.style.opacity = String(opacity);
    overlay.append(copy);
    $('leaf-viewport').append(overlay);
    pageOverlay = overlay;
    return overlay;
  }

  function animatePage(active, overlay, direction, opacity) {
    const token = pageTransition;
    const exit = overlay.animate([
      { opacity, transform: 'translateX(0)' },
      { opacity: 0, transform: 'translateX(' + (-5 * direction) + 'px)' }
    ], { duration: 150, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' });
    const enter = active.animate([
      { opacity: 0, translate: (8 * direction) + 'px 0' },
      { opacity: 1, translate: '0px 0' }
    ], { duration: 240, delay: 30, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' });
    pageAnimations = [exit, enter];
    enter.onfinish = () => { if (token === pageTransition) clearPageTransition(); };
  }

  function fitElement(element, container, maxScale = 1) {
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
    const scale = Math.min(1, maxScale, width / contentWidth, Math.max(1, height - 1) / contentHeight);
    element.style.left = left + Math.max(0, (width - contentWidth * scale) / 2) + 'px';
    element.style.transform = 'scale(' + scale + ')';
    if (element.classList.contains('sheet-inner')) element.style.top = top + Math.max(0, (height - contentHeight * scale) / 2) + 'px';
  }

  function fitCover() {
    // CSS shares the physical book dimensions between the cover and paper.
    document.querySelector('.closed-journal').style.removeProperty('transform');
  }

  function fitLayout() {
    if (printingLayout) return;
    if (state === 'closed') { fitCover(); return; }
    if (state !== 'open' && state !== 'opening') return;
    loadPageImages($(chapters[currentPage].id));
    if (classic) fitClassic();
    else fitElement($(chapters[currentPage].id), $('leaf-viewport'));
    const margin = document.querySelector('.journal-margin');
    if (margin.clientHeight) fitElement(document.querySelector('.margin-sticky'), margin);
  }

  function requestFit() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(fitLayout);
  }

  function showPage(index, options = {}) {
    if (index < 0 || index >= chapters.length) return;
    const side = options.side === 1 ? 1 : 0;
    const changed = index !== currentPage || side !== currentSide;
    const previous = $(chapters[currentPage].id);
    const direction = index === currentPage ? (side >= currentSide ? 1 : -1) : (index > currentPage ? 1 : -1);
    const animate = changed && state === 'open' && !printingLayout && !motion.matches && options.animate !== false && typeof previous.animate === 'function';
    const previousOpacity = animate ? Number(getComputedStyle(previous).opacity) : 1;
    clearPageTransition();
    const overlay = animate ? capturePage(previous, currentSide, previousOpacity) : undefined;
    currentPage = index;
    currentSide = side;
    document.body.dataset.side = String(currentSide);
    chapters.forEach((chapter, position) => {
      const leaf = $(chapter.id);
      leaf.hidden = position !== index;
      leaf.classList.remove('leaf-arriving');
    });
    const active = $(chapters[index].id);
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
    if (overlay) animatePage(active, overlay, direction, previousOpacity);
    if (options.focus !== false) active.focus({ preventScroll: true });
    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  function finishOpening() {
    if (state !== 'opening') return;
    clearTimeout(openingTimer);
    state = 'open';
    gate.hidden = true; gate.inert = true;
    pages.inert = false;
    document.body.classList.remove('journal-closed', 'journal-opening');
    document.body.classList.add('journal-open');
    // Keep the exact page already visible below the cover; do not render it twice.
    fitLayout();
    if (openingFocus) $(chapters[currentPage].id).focus({ preventScroll: true });
  }
  function openJournal(options = {}) {
    if (state !== 'closed') return;
    clearPageTransition();
    state = 'opening';
    openingFocus = options.focus !== false;
    // Reset the destination while the whole book is still hidden. The real page,
    // with its final fitted layout, is the only paper behind the rotating cover.
    showPage(Number.isInteger(options.page) ? options.page : 0, { side: options.side, animate: false, focus: false, scroll: false });
    pages.inert = true;
    pages.hidden = false;
    fitLayout();
    openButton.disabled = true;
    document.body.classList.remove('journal-closed');
    document.body.classList.add('journal-opening');
    if (motion.matches) { finishOpening(); return; }
    $('cover-hinge').getBoundingClientRect();
    gate.classList.add('is-opening');
    openingTimer = setTimeout(finishOpening, 720);
  }
  function closeJournal() {
    clearTimeout(openingTimer);
    clearPageTransition();
    if ($('product-dialog').open) $('product-dialog').close();
    state = 'closed';
    pages.hidden = true; pages.inert = true;
    // A canceled opening must not start a reverse transition on the next click.
    gate.classList.add('is-resetting');
    gate.hidden = false; gate.inert = false;
    gate.classList.remove('is-opening'); gate.scrollTop = 0;
    openButton.disabled = false;
    document.body.classList.remove('journal-open', 'journal-opening', 'dialog-open');
    document.body.classList.add('journal-closed');
    window.scrollTo({ top: 0, behavior: 'instant' });
    openButton.focus({ preventScroll: true });
    fitCover();
    gate.getBoundingClientRect();
    gate.classList.remove('is-resetting');
  }
  openButton.addEventListener('click', () => openJournal());
  $('close-journal').addEventListener('click', closeJournal);
  $('cover-hinge').addEventListener('transitionend', event => {
    if (event.target === $('cover-hinge') && event.propertyName === 'transform') finishOpening();
  });
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    clearPageTransition();
    if (state === 'opening') finishOpening();
  });

  document.querySelectorAll('[data-page-target]').forEach(control => {
    control.addEventListener('click', event => {
      event.preventDefault();
      if (state !== 'open') return;
      const index = chapters.findIndex(chapter => chapter.id === control.dataset.pageTarget);
      if (index < 0) return;
      showPage(index, { side: classic && narrowSpread.matches && chapters[index].id === 'contents' ? 1 : 0 });
      if (control.hasAttribute('data-contents-link')) $('contents-title').focus({ preventScroll: true });
    });
  });
  $('title-next').addEventListener('click', () => turnPage(1));
  $('page-prev').addEventListener('click', () => turnPage(-1));
  $('page-next').addEventListener('click', () => turnPage(1));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && state === 'opening') { closeJournal(); return; }
    if (state !== 'open' || $('product-dialog').open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,button,a,select,[contenteditable]')) return;
    if (event.key === 'ArrowRight' && (currentPage < chapters.length - 1 || (classic && narrowSpread.matches && currentSide === 0))) { event.preventDefault(); turnPage(1); }
    if (event.key === 'ArrowLeft' && (currentPage > 0 || (classic && narrowSpread.matches && currentSide === 1))) { event.preventDefault(); turnPage(-1); }
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
    $('collection').querySelectorAll('.product-card').forEach(card => {
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
    clearPageTransition();
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
  // postMessage also works for the comparison opened directly from a local file.
  window.addEventListener('message', event => {
    if (window.parent === window || event.source !== window.parent || event.data?.type !== 'bloom-preview') return;
    if (event.data.action === 'open') openJournal({ focus: false });
    if (event.data.action === 'close') closeJournal();
    if (event.data.action === 'page') {
      const index = chapters.findIndex(chapter => chapter.id === event.data.id);
      if (index < 0) return;
      const side = classic && narrowSpread.matches && chapters[index].id === 'contents' ? 1 : 0;
      if (state === 'closed') openJournal({ page: index, side, focus: false });
      else showPage(index, { side, focus: false });
    }
  });
  if (window.parent !== window) window.parent.postMessage({ type: 'bloom-preview-ready' }, '*');
  fitCover();
})();
