const esc = s => String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const shortDate = d => { const [y, m] = String(d || '').split('-'); return m ? MONTHS[Number(m) - 1] + ' ' + y : ''; };
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const card = (l, extra) => '<a class="card" href="destination.html?place=' + encodeURIComponent(l.slug) + '">'
  + '<img src="' + esc(l.cover) + '" alt="' + esc(l.name) + '" loading="lazy"><div>'
  + (extra || '')
  + '<small>' + (l.flagAsset ? '<img class="flag-img" src="' + esc(l.flagAsset) + '" alt=""> ' : esc(l.flag) + ' ') + esc(l.region) + '</small>'
  + '<h3>' + esc(l.name) + '</h3></div></a>';

const figure = (p, i, l) => '<figure class="' + esc(p.class) + '" tabindex="0" role="button" aria-label="Open ' + esc(p.alt || l.name) + '" data-index="' + i + '">'
  + (p.kind === 'video'
    ? '<video src="' + esc(p.src) + '" muted playsinline preload="metadata"></video><span class="video-play">▶</span>'
    : '<img src="' + esc(p.src) + '" alt="' + esc(p.alt || l.name) + '" loading="lazy">')
  + ((p.alt || mapUrl(p, l)) ? '<figcaption>' + esc(p.alt) + mapLink(p, l) + '</figcaption>' : '')
  + '</figure>';

// Google Maps link: exact spot from the photo's GPS, otherwise the place itself.
// Not shown for home spots (South Padre Island, Iowa Great Lakes).
const NO_MAP = ['south-padre-island', 'iowa-great-lakes'];
const mapUrl = (p, l) => {
  if (l.home || NO_MAP.includes(l.slug)) return '';
  if (p.gps) return 'https://www.google.com/maps/search/?api=1&query=' + p.gps[0] + ',' + p.gps[1];
  if (!l.countryCode) return '';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.name + ', ' + l.region);
};
const mapLink = (p, l) => {
  const u = mapUrl(p, l);
  return u ? ' <a class="map-link" href="' + u + '" target="_blank" rel="noopener">MAP ↗</a>' : '';
};

(async () => {
  try {
    const r = await fetch('data/locations.json', { cache: 'no-cache' });
    if (!r.ok) throw Error();
    const ls = await r.json();

    // Home page: all locations. South Padre Island and Iowa Great Lakes pinned first,
    // then newest "updated" first, then undated ones A–Z. Dated cards get a date tag.
    const PINNED = ['south-padre-island', 'iowa-great-lakes'];
    const rank = l => PINNED.includes(l.slug) ? PINNED.indexOf(l.slug) : PINNED.length;
    const dateTag = l => l.updated ? '<span class="card-date">' + (l.home ? 'HOME · ' : '') + esc(shortDate(l.updated)) + '</span>' : '';
    const cards = document.querySelector('#locationCards');
    if (cards) cards.innerHTML = [...ls].sort((a, b) =>
      rank(a) - rank(b)
      || (a.updated && b.updated ? b.updated.localeCompare(a.updated)
      : a.updated ? -1 : b.updated ? 1 : a.name.localeCompare(b.name))
    ).map(l => card(l, dateTag(l))).join('');

    // Home page: the 4 most recently updated locations.
    // Locations with "home": true (Dickinson County, Iowa) are photos from home, not trips.
    const latest = document.querySelector('#latestCards');
    if (latest) {
      const recent = ls.filter(l => l.updated).sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 4);
      if (recent.length) latest.innerHTML = recent.map(l => card(l, '<span class="card-date">' + (l.home ? 'HOME · ' : '') + esc(shortDate(l.updated)) + '</span>')).join('');
      else latest.closest('section').hidden = true;
    }

    // Destination page
    const gallery = document.querySelector('#gallery');
    if (!gallery) return;
    const l = ls.find(x => x.slug === new URLSearchParams(location.search).get('place')) || ls[0];
    if (!l) return;
    document.title = l.name + ' — Kiteboard Okoboji';
    document.querySelector('#locationName').textContent = l.name;
    document.querySelector('#region').textContent = l.region;
    document.querySelector('#kicker').textContent = l.kicker;

    // Group photos into visits (consecutive photos with the same "visit" label)
    const visits = [];
    l.photos.forEach((p, i) => {
      const v = visits[visits.length - 1];
      if (v && v.name === (p.visit || '')) v.items.push([p, i]);
      else visits.push({ name: p.visit || '', items: [[p, i]] });
    });

    if (visits.length > 1 || visits[0].name) {
      gallery.classList.add('visits');
      gallery.innerHTML = (visits.length > 1
        ? '<nav class="visit-nav"><span>' + visits.length + (l.home ? ' SETS' : ' TRIPS') + '</span>' + visits.map(v => '<a href="#' + slugify(v.name) + '">' + esc(v.name) + '</a>').join('') + '</nav>'
        : '')
        + visits.map((v, n) => '<section class="visit" id="' + slugify(v.name) + '">'
          + '<div class="visit-head"><small>' + (l.home ? 'FROM HOME' : n === 0 && visits.length > 1 ? 'LATEST TRIP' : 'TRIP ' + (visits.length - n) + ' OF ' + visits.length) + ' · ' + v.items.length + (v.items.length === 1 ? ' ITEM' : ' ITEMS') + '</small><h2>' + esc(v.name) + '</h2></div>'
          + '<div class="gallery-grid">' + v.items.map(([p, i]) => figure(p, i, l)).join('') + '</div></section>').join('');
    } else {
      gallery.innerHTML = l.photos.map((p, i) => figure(p, i, l)).join('');
    }

    const d = document.querySelector('#viewer');
    d.querySelector('button').onclick = () => d.close();
    const open = f => {
      const p = l.photos[Number(f.dataset.index)];
      const view = d.querySelector('div');
      view.replaceChildren();
      const el = document.createElement(p.kind === 'video' ? 'video' : 'img');
      el.src = p.src;
      el.alt = p.alt || l.name;
      if (p.kind === 'video') { el.controls = true; el.playsInline = true; }
      view.append(el);
      d.querySelector('p').innerHTML = esc(p.alt) + mapLink(p, l);
      d.showModal();
    };
    gallery.querySelectorAll('figure').forEach(f => {
      f.onclick = e => { if (!e.target.closest('.map-link')) open(f); };
      f.onkeydown = e => { if (e.target.closest('.map-link')) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(f); } };
    });
    d.addEventListener('close', () => { const video = d.querySelector('video'); if (video) video.pause(); });
  } catch {
    const target = document.querySelector('#gallery') || document.querySelector('#locationCards');
    if (target) target.textContent = 'Locations could not be loaded. Please refresh.';
  }
})();
