(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const shell = $('mag-shell'), stage = $('mag-stage'), cover = $('cover'), reading = $('reading');
  const pages = [...document.querySelectorAll('[data-page]')];
  const titles = ['A Little Hello', 'Our Story', 'Little Things, Little Joys', 'The Collection', 'Gifts with Joy', 'A Little More Beauty'];
  const mobile = window.matchMedia('(max-width: 760px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const contents = $('contents-dialog'), productDialog = $('product-dialog');
  let state = 'closed', current = 0, motionToken = 0, motionTimer, motionLayer, motionAnimations = [];
  let layoutFrame, dialogOpener, gesture, suppressClickUntil = 0;

  function visibleIndices(index = current) {
    if (mobile.matches) return [index];
    const first = Math.floor(index / 2) * 2;
    return [first, first + 1].filter(item => item < pages.length);
  }
  function neighbour(direction) {
    const target = mobile.matches ? current + direction : Math.floor(current / 2) * 2 + direction * 2;
    return target >= 0 && target < pages.length ? target : null;
  }
  function loadImages(page) {
    page.querySelectorAll('img[data-src]').forEach(image => {
      image.decoding = 'async';
      image.src = image.dataset.src;
      delete image.dataset.src;
    });
  }
  function fitPage(page) {
    if (page.hidden || !page.clientHeight) return;
    const inner = page.querySelector('.page-content'), css = getComputedStyle(page);
    const left = parseFloat(css.paddingLeft), right = parseFloat(css.paddingRight);
    const top = parseFloat(css.paddingTop), bottom = parseFloat(css.paddingBottom);
    const width = page.clientWidth - left - right, height = page.clientHeight - top - bottom;
    if (width <= 0 || height <= 0) return;
    const scroll = inner.scrollTop;
    inner.style.cssText = 'position:absolute;left:' + left + 'px;top:' + top + 'px;width:' + width + 'px;height:auto;transform:none;overflow:visible;transform-origin:top left';
    const naturalHeight = Math.max(inner.offsetHeight, inner.scrollHeight, 1);
    const naturalWidth = Math.max(inner.scrollWidth, width);
    const scale = Math.min(1, width / naturalWidth, (height - 1) / naturalHeight);
    if (scale >= .86) {
      inner.style.transform = 'scale(' + scale + ')';
      inner.style.left = left + Math.max(0, (width - naturalWidth * scale) / 2) + 'px';
    } else {
      // Short windows retain readable type and can scroll inside this one sheet.
      inner.style.height = height + 'px';
      inner.style.overflowY = 'auto';
      inner.style.overflowX = 'hidden';
      inner.style.scrollbarWidth = 'thin';
      inner.scrollTop = scroll;
    }
  }
  function fitPages() { if (!reading.hidden) pages.forEach(fitPage); }
  function requestFit() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(fitPages); }
  function setBodyState() {
    document.body.classList.remove('mag-closed', 'mag-opening', 'mag-open');
    document.body.classList.add(state === 'closed' ? 'mag-closed' : state === 'opening' ? 'mag-opening' : 'mag-open');
  }
  function updateControls() {
    const visible = visibleIndices();
    const range = visible.map(index => String(index + 1).padStart(2, '0')).join('—');
    $('page-range').textContent = range + ' / 06';
    $('page-description').textContent = visible.map(index => titles[index]).join(' · ');
    $('reader-nav').hidden = state === 'closed';
    $('cover-whisper').hidden = state !== 'closed';
    $('close-issue').hidden = state === 'closed';
    $('previous-page').disabled = state !== 'open' || neighbour(-1) === null;
    $('next-page').disabled = state !== 'open' || neighbour(1) === null;
    $('previous-page').setAttribute('aria-label', mobile.matches ? 'Previous page' : 'Previous spread');
    $('next-page').setAttribute('aria-label', mobile.matches ? 'Next page' : 'Next spread');
    $('reading-status').textContent = state === 'closed' ? 'The magazine cover. Open to read six little stories.' : 'Page' + (visible.length > 1 ? 's ' : ' ') + range + ' of 06. ' + visible.map(index => titles[index]).join('. ');
    contents.querySelectorAll('[data-go]').forEach(button => {
      if (Number(button.dataset.go) === current) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  function render(index) {
    current = Math.max(0, Math.min(pages.length - 1, index));
    const visible = visibleIndices();
    pages.forEach((page, position) => {
      page.hidden = !visible.includes(position);
      page.classList.toggle('is-right', !mobile.matches && position % 2 === 1);
      if (!page.hidden) loadImages(page);
    });
    updateControls();
    fitPages();
  }
  function cancelMotion() {
    motionToken++;
    clearTimeout(motionTimer);
    motionAnimations.forEach(animation => animation.cancel());
    motionAnimations = [];
    if (motionLayer) motionLayer.remove();
    motionLayer = undefined;
  }
  function visualCopy(element) {
    const copy = element.cloneNode(true);
    [copy, ...copy.querySelectorAll('[id],[tabindex],[data-page]')].forEach(node => {
      node.removeAttribute('id'); node.removeAttribute('tabindex'); node.removeAttribute('data-page');
    });
    copy.hidden = false;
    const inner = element.querySelector('.page-content');
    if (inner) copy.dataset.snapshotScroll = String(inner.scrollTop);
    return copy;
  }
  function restoreSnapshotScroll(layer) {
    layer.querySelectorAll('[data-snapshot-scroll]').forEach(copy => {
      copy.querySelector('.page-content').scrollTop = Number(copy.dataset.snapshotScroll);
      delete copy.dataset.snapshotScroll;
    });
  }
  function turnLayer(front, back, keeper, direction, opening = false) {
    const layer = document.createElement('div');
    layer.className = 'turn-overlay' + (direction < 0 ? ' reverse' : '');
    layer.inert = true; layer.setAttribute('aria-hidden', 'true');
    if (keeper || (opening && !mobile.matches)) {
      const still = document.createElement('div');
      still.className = 'turn-keeper ' + (direction > 0 ? 'left' : 'right');
      if (keeper) still.append(keeper);
      layer.append(still);
    }
    const lift = document.createElement('div'); lift.className = 'turn-lift';
    const leaf = document.createElement('div'); leaf.className = 'turn-leaf';
    for (const [name, content] of [['front', front], ['back', back]]) {
      const face = document.createElement('div'); face.className = 'turn-face ' + name;
      face.append(content); leaf.append(face);
    }
    const shade = document.createElement('div'); shade.className = 'turn-shade'; leaf.append(shade);
    lift.append(leaf); layer.append(lift); stage.append(layer); restoreSnapshotScroll(layer);
    motionLayer = layer;
    return { layer, leaf, lift, shade };
  }
  function animateTurn(front, back, keeper, direction, opening, done) {
    const { leaf, lift, shade } = turnLayer(front, back, keeper, direction, opening);
    const token = motionToken, duration = opening ? 520 : 440;
    const easing = opening ? 'cubic-bezier(.42,0,.24,1)' : 'cubic-bezier(.36,.02,.23,1)';
    const primary = leaf.animate([
      { transform: 'rotateY(0deg)' },
      { transform: 'rotateY(' + (-180 * direction) + 'deg)' }
    ], { duration, easing, fill: 'both' });
    const shadows = shade.animate([{ opacity: 0 }, { opacity: .8, offset: .47 }, { opacity: 0 }], { duration, easing: 'linear', fill: 'both' });
    motionAnimations = [primary, shadows];
    if (opening) {
      // Once almost flat, the cover passes beneath the prepared paper. Its
      // blank lining never carries compressed or mirrored page lettering.
      motionAnimations.push(motionLayer.animate([
        { zIndex: '20', offset: 0 }, { zIndex: '20', offset: .65 },
        { zIndex: '0', offset: .67 }, { zIndex: '0', offset: 1 }
      ], { duration, easing: 'linear', fill: 'both' }));
    }
    if (opening && !mobile.matches) {
      const distance = pages[visibleIndices()[0]].offsetWidth / 2;
      motionAnimations.push(lift.animate([{ transform: 'translateX(' + (-distance) + 'px)' }, { transform: 'translateX(0)' }], { duration, easing, fill: 'both' }));
    }
    const complete = () => {
      if (token !== motionToken) return;
      cancelMotion(); done();
    };
    primary.onfinish = complete;
    motionTimer = setTimeout(complete, duration + 120);
  }
  function finishOpening() {
    state = 'open'; setBodyState(); reading.inert = false; cover.hidden = true;
    updateControls(); fitPages(); pages[current].focus({ preventScroll: true });
  }
  function openMagazine(index = 0) {
    if (state !== 'closed') return goTo(index);
    cancelMotion();
    state = 'opening'; setBodyState();
    render(index); reading.hidden = false; reading.inert = true; fitPages();
    if (reduced.matches || typeof cover.animate !== 'function') { cover.hidden = true; finishOpening(); return; }
    const front = visualCopy(cover), back = document.createElement('div');
    back.className = 'cover-lining';
    animateTurn(front, back, null, 1, true, finishOpening);
    cover.hidden = true;
  }
  function closeMagazine() {
    cancelMotion();
    [contents, productDialog].forEach(dialog => { if (dialog.open) dialog.close(); });
    state = 'closed'; setBodyState(); reading.hidden = true; reading.inert = true;
    cover.hidden = false; updateControls(); $('open-issue').focus({ preventScroll: true });
  }
  function goTo(index, options = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= pages.length) return;
    if (state === 'closed') return openMagazine(index);
    if (state === 'opening') { cancelMotion(); state = 'open'; setBodyState(); reading.inert = false; cover.hidden = true; render(index); pages[index].focus({ preventScroll: true }); return; }
    const oldIndices = visibleIndices(), nextIndices = visibleIndices(index);
    const changed = oldIndices.join(',') !== nextIndices.join(',');
    const direction = index >= current ? 1 : -1;
    cancelMotion();
    if (!changed || reduced.matches || options.animate === false || typeof stage.animate !== 'function') { render(index); pages[index].focus({ preventScroll: true }); return; }
    const frontIndex = mobile.matches ? oldIndices[0] : direction > 0 ? oldIndices[1] : oldIndices[0];
    const front = visualCopy(pages[frontIndex]);
    const keeper = mobile.matches ? null : visualCopy(pages[direction > 0 ? oldIndices[0] : oldIndices[1]]);
    render(index);
    const backIndex = mobile.matches ? index : direction > 0 ? nextIndices[0] : nextIndices[1];
    const back = visualCopy(pages[backIndex]);
    animateTurn(front, back, keeper, direction, false, () => {
      updateControls(); fitPages(); pages[current].focus({ preventScroll: true });
    });
  }
  function turn(direction) {
    if (state !== 'open') return;
    const target = neighbour(direction);
    if (target !== null) goTo(target);
  }
  $('open-issue').addEventListener('click', () => openMagazine());
  $('close-issue').addEventListener('click', closeMagazine);
  $('close-magazine-end').addEventListener('click', closeMagazine);
  $('home-link').addEventListener('click', event => { event.preventDefault(); closeMagazine(); });
  $('previous-page').addEventListener('click', () => turn(-1));
  $('next-page').addEventListener('click', () => turn(1));
  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => {
    if (contents.open) contents.close();
    goTo(Number(button.dataset.go));
  }));

  function showDialog(dialog, opener) { dialogOpener = opener; dialog.showModal(); }
  $('contents-button').addEventListener('click', event => showDialog(contents, event.currentTarget));
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  [contents, productDialog].forEach(dialog => {
    dialog.addEventListener('close', () => { if (dialogOpener && !dialogOpener.closest('[hidden]')) dialogOpener.focus({ preventScroll: true }); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  });
  const products = {
    journal: { title: 'The Everyday Journal', category: 'PEN & PAPER', art: 'journal-art', alt: 'A cream linen Room to Bloom journal with canary and floral artwork', copy: 'For thoughts taking shape, plans still growing, and little things worth remembering. A familiar canary on the cover, and a little possibility inside.' },
    mug: { title: 'The Slow Morning Mug', category: 'EVERYDAY LITTLE JOYS', art: 'mug-art', alt: 'A cream mug with a golden canary on a botanical sprig', copy: 'Your first cup. A quiet afternoon. A moment all to yourself. A gentle little companion for making an ordinary pause feel lovely.' },
    stationery: { title: 'Little Notebooks & Notes', category: 'NOTEBOOKS & STATIONERY', art: 'stationery-art', alt: 'A small notebook, cream Room to Bloom note card with the canary, and a wooden pencil', copy: 'A little notebook for a passing thought. A small note for someone lovely. Cream paper, garden sage, and our familiar bird make room for ideas and words worth sharing.' },
    tshirt: { title: 'The Everyday Bloom Tee', category: 'EVERYDAY COMFORTS', art: 'tshirt-art', alt: 'A fully unfolded cream T-shirt with both sleeves visible and a Room to Bloom canary logo', copy: 'A little sunshine to carry with you. A cream tee, a gentle wordmark, and our golden canary — an everyday reminder to grow in your own way.' },
    gift: { title: 'The Little Joy Gift Box', category: 'THOUGHTFULLY GIVEN', art: 'gift-art', alt: 'A blush gift box with a cream ribbon and a canary gift tag', copy: 'For a fresh start, a thoughtful thank-you, or no particular reason at all. A soft ribbon, familiar details, and a little joy chosen with care.' },
    frame: { title: 'The Little Moments Frame', category: 'A MOMENT TO KEEP', art: 'frame-art', alt: 'A pale wooden photo frame with botanical artwork and the Room to Bloom logo', copy: 'A little home for the moments you want to keep close. Warm wood, a cream surround, and a gentle reminder to embrace every season.' },
    jewellery: { title: 'The Treasured Things Box', category: 'LITTLE KEEPSAKES', art: 'jewellery-art', alt: 'A blush jewellery box with cream compartments and a canary logo', copy: 'Precious things, thoughtfully tucked away. A soft blush box and our familiar little signature turn an everyday corner into a place for small treasures.' }
  };
  document.querySelectorAll('[data-product]').forEach(button => button.addEventListener('click', () => {
    const product = products[button.dataset.product];
    if (!product) return;
    const art = $('detail-art'); art.className = 'detail-art ' + product.art; art.replaceChildren(); art.setAttribute('aria-label', product.alt);
    if (button.dataset.product === 'stationery') {
      const source = document.querySelector('.product-art.stationery-art'); loadImages(source);
      for (const part of ['.notebook-stack', '.notecard', '.paper-pencil']) art.append(source.querySelector(part).cloneNode(true));
    }
    $('product-title').textContent = product.title; $('product-category').textContent = product.category; $('product-description').textContent = product.copy;
    showDialog(productDialog, button);
  }));
  document.addEventListener('keydown', event => {
    if (contents.open || productDialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]')) return;
    if (event.key === 'Escape' && state !== 'closed') { event.preventDefault(); closeMagazine(); }
    if (state !== 'open') return;
    if (event.key === 'ArrowRight') { event.preventDefault(); turn(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1); }
  });
  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || !['touch', 'pen'].includes(event.pointerType) || state !== 'open') return;
    gesture = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
  });
  stage.addEventListener('pointercancel', () => { gesture = undefined; });
  stage.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y, elapsed = performance.now() - gesture.time;
    gesture = undefined;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4 || elapsed > 900) return;
    suppressClickUntil = performance.now() + 350;
    turn(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  $('print-button').addEventListener('click', async () => {
    const button = $('print-button'); button.disabled = true; button.setAttribute('aria-busy', 'true');
    pages.forEach(loadImages);
    const pictures = [...document.querySelectorAll('img[src]')];
    await Promise.all(pictures.map(image => image.decode().catch(() => {})));
    await Promise.all(['assets/products.png', 'assets/collection-extras.png', 'assets/tshirt-open-sleeves.png'].map(src => new Promise(resolve => {
      const image = new Image(); image.onload = resolve; image.onerror = resolve; image.src = src;
    })));
    button.disabled = false; button.removeAttribute('aria-busy'); window.print();
  });
  window.addEventListener('beforeprint', () => { pages.forEach(loadImages); if (state === 'opening') { cancelMotion(); finishOpening(); } else cancelMotion(); });
  window.addEventListener('afterprint', requestFit);
  window.addEventListener('resize', () => {
    cancelMotion();
    if (state === 'opening') finishOpening();
    render(current);
  });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', requestFit);
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    cancelMotion(); if (state === 'opening') finishOpening();
  });
  document.querySelectorAll('img').forEach(image => image.addEventListener('load', requestFit));
  if ('ResizeObserver' in window) { const observer = new ResizeObserver(requestFit); observer.observe(shell); }
  window.addEventListener('load', requestFit);
  reading.inert = true;
  render(0);
})();
