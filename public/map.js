// World map of every gallery in data/locations.json.
// Each location's pin comes from, in order:
//   1. an optional "map": [lat, lng] field on the location (to pin it exactly),
//   2. the median of its photos' "gps" values,
//   3. the PLACES table below (for galleries without GPS),
//   4. the centre of its country (countryCode).
// New locations added to locations.json show up automatically.
(() => {
  const esc = s => String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  const PLACES = {
    'bahrain': [26.2235, 50.5876], 'california': [34.0522, -118.2437], 'cambodia': [13.4125, 103.867],
    'doha': [25.2854, 51.531], 'hoover-dam': [36.0161, -114.7377], 'maui': [20.7984, -156.3319],
    'montevideo': [-34.9011, -56.1645], 'moscow': [55.7558, 37.6173], 'oahu': [21.3069, -157.8583],
    'romania': [44.4268, 26.1025], 'south-africa': [-33.8, 18.46], 'sweden': [59.8586, 17.6389],
    'beijing': [39.9042, 116.4074], 'yellowstone': [44.428, -110.5885], 'trondheim': [63.4305, 10.3951],
    'kaohsiung': [22.6273, 120.3014], 'newport': [41.4901, -71.3128], 'salt-lake-city': [40.7608, -111.891],
    'new-orleans': [29.9511, -90.0715], 'jamaica': [18.2705, -78.3476], 'south-dakota': [43.8791, -103.4591],
    'new-york': [40.7128, -74.006], 'kamensk-uralskiy': [56.4149, 61.9189], 'seoul': [37.5665, 126.978],
    'albert-city': [42.7816, -94.9486]
  };
  const COUNTRIES = {
    US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.6], BR: [-14.2, -51.9], AR: [-38.4, -63.6],
    CL: [-35.7, -71.5], UY: [-32.5, -55.8], DO: [18.7, -70.2], JM: [18.1, -77.3], HN: [15.2, -86.2],
    GB: [52.4, -1.5], IE: [53.4, -8.2], FR: [46.2, 2.2], DE: [51.2, 10.5], BE: [50.5, 4.5], DK: [56.3, 9.5],
    SE: [60.1, 18.6], NO: [60.5, 8.5], PL: [51.9, 19.1], PT: [39.4, -8.2], IT: [41.9, 12.6], RO: [45.9, 25],
    RU: [55.8, 37.6], TR: [39, 35.2], GL: [64.2, -51.7], EG: [26.8, 30.8], ET: [9.1, 40.5], ZA: [-30.6, 22.9],
    MU: [-20.3, 57.6], IL: [31.0, 34.9], PS: [31.9, 35.2], JO: [30.6, 36.2], LB: [33.9, 35.9], AE: [23.4, 53.8],
    QA: [25.4, 51.2], BH: [26.0, 50.6], IN: [20.6, 79], CN: [35.9, 104.2], HK: [22.3, 114.2], TW: [23.7, 121],
    JP: [36.2, 138.3], KR: [35.9, 127.8], VN: [14.1, 108.3], TH: [15.9, 101], KH: [12.6, 105], MY: [4.2, 102],
    SG: [1.35, 103.8], ID: [-0.8, 113.9], AU: [-25.3, 133.8], NZ: [-40.9, 174.9]
  };
  const HOME = ['iowa-great-lakes', 'south-padre-island', 'albert-city'];

  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const okPoint = p => Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1])
    && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180 && !(Math.abs(p[0]) < 0.01 && Math.abs(p[1]) < 0.01);
  const pointFor = l => {
    if (okPoint(l.map)) return [Number(l.map[0]), Number(l.map[1])];
    const g = (l.photos || []).map(p => p.gps).filter(okPoint);
    if (g.length) return [median(g.map(p => Number(p[0]))), median(g.map(p => Number(p[1])))];
    return PLACES[l.slug] || COUNTRIES[l.countryCode] || null;
  };
  const href = l => 'destination.html?place=' + encodeURIComponent(l.slug);
  const count = l => { const n = (l.photos || []).length; return n + (n === 1 ? ' PHOTO' : ' PHOTOS'); };
  const flag = l => (l.flagAsset ? '<img class="flag-img" src="' + esc(l.flagAsset) + '" alt=""> ' : '');

  const map = L.map('worldMap', { minZoom: 2, maxZoom: 11, zoomSnap: 0.5, maxBounds: [[-75, -210], [85, 210]], maxBoundsViscosity: 0.8, attributionControl: true })
    .setView([25, 10], 2);
  map.attributionControl.setPrefix('').addAttribution('Map: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');

  // Base map: country shapes bundled with the site (data/world-50m.json, Natural Earth via world-atlas),
  // so it needs no map service or API key. The file is TopoJSON; decode it into GeoJSON here.
  const topoToGeo = topo => {
    const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
    const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
    const ring = ids => { const out = []; ids.forEach(i => { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; a.forEach((pt, k) => { if (k || !out.length) out.push(pt); }); }); return out; };
    const geom = g => g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.arcs.map(ring) }
      : g.type === 'MultiPolygon' ? { type: 'MultiPolygon', coordinates: g.arcs.map(p => p.map(ring)) } : null;
    return { type: 'FeatureCollection', features: topo.objects.countries.geometries.map(g => ({ type: 'Feature', properties: {}, geometry: geom(g) })).filter(f => f.geometry) };
  };
  fetch('data/world-50m.json').then(r => r.json()).then(topo => {
    L.geoJSON(topoToGeo(topo), { interactive: false, style: { color: '#364a51', weight: 0.8, fillColor: '#203037', fillOpacity: 1 } }).addTo(map).bringToBack();
  }).catch(() => {});

  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 45, spiderfyOnMaxZoom: true,
    iconCreateFunction: c => L.divIcon({ html: '<span>' + c.getChildCount() + '</span>', className: 'ko-cluster', iconSize: [42, 42] })
  });
  map.addLayer(cluster);

  fetch('data/locations.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(ls => {
    const places = ls.map(l => ({ l, at: pointFor(l) })).filter(p => p.at).sort((a, b) => a.l.name.localeCompare(b.l.name));

    places.forEach(p => {
      const l = p.l;
      p.marker = L.marker(p.at, {
        title: l.name, alt: l.name, riseOnHover: true,
        icon: L.divIcon({ className: '', html: '<div class="ko-pin' + (HOME.includes(l.slug) ? ' home' : '') + '"></div>', iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10] })
      }).bindPopup('<a class="ko-pop" href="' + href(l) + '"><img src="' + esc(l.cover) + '" alt="" loading="lazy"><div>'
        + '<small>' + flag(l) + esc(l.region) + '</small><h3>' + esc(l.name) + '</h3><span>' + count(l) + ' · VIEW GALLERY →</span></div></a>');
      cluster.addLayer(p.marker);
    });

    document.querySelector('#mapCount').textContent = places.length + ' galleries, pinned where the photos were taken. Tap a pin to open its photos.';

    const list = document.querySelector('#mapPlaces');
    list.innerHTML = places.map((p, i) => '<li data-i="' + i + '" data-q="' + esc((p.l.name + ' ' + p.l.region + ' ' + (p.l.kicker || '')).toLowerCase()) + '"><button type="button">'
      + '<img src="' + esc(p.l.cover) + '" alt="" loading="lazy"><span><b>' + esc(p.l.name) + '</b><small>' + esc(p.l.region) + '</small></span></button></li>').join('')
      + '<li class="empty" hidden>No places match.</li>';
    const items = [...list.querySelectorAll('li[data-i]')];
    const empty = list.querySelector('.empty');

    const show = p => {
      cluster.zoomToShowLayer(p.marker, () => p.marker.openPopup());
      if (window.matchMedia('(max-width:900px)').matches) document.querySelector('#worldMap').scrollIntoView({ behavior: 'smooth' });
    };
    items.forEach(li => { li.querySelector('button').onclick = () => show(places[Number(li.dataset.i)]); });

    const search = document.querySelector('#mapSearch');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const hits = [];
      items.forEach(li => { const on = !q || li.dataset.q.includes(q); li.hidden = !on; if (on) hits.push(places[Number(li.dataset.i)]); });
      empty.hidden = hits.length > 0;
      cluster.clearLayers();
      cluster.addLayers(hits.map(p => p.marker));
      if (q && hits.length) map.fitBounds(L.latLngBounds(hits.map(p => p.at)).pad(0.3), { maxZoom: 9 });
    });
    search.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const first = items.find(li => !li.hidden);
      if (first) show(places[Number(first.dataset.i)]);
    });
    const q = new URLSearchParams(location.search).get('q');
    if (q) { search.value = q; search.dispatchEvent(new Event('input')); }
  }).catch(() => {
    document.querySelector('#mapCount').textContent = 'Locations could not be loaded. Please refresh.';
  });
})();
