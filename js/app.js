/* 집지킴 360 — 앱 (해시 라우팅 · 뷰 · 액션) */
(function () {
  const E = ZJ.eng;
  const C = ZJ.CONST;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- 저장소 (브라우저 저장 실패에도 동작) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('zj_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('zj_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    clear() { try { Object.keys(localStorage).filter((k) => k.startsWith('zj_')).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* noop */ } },
  };

  const defaultVault = () => ({ in: {}, out: {}, judg: {}, cost: {}, moveIn: '2024-11-01', moveOut: '2026-10-31', claim: 800000 });
  const state = {
    filters: { deal: 'all', room: 'all', safeOnly: false, q: '' },
    selected: null,
    favs: store.get('favs', []),
    unlocked: store.get('unlocked', []),
    freeUsed: store.get('freeUsed', false),
    care: store.get('care', false),
    ct: store.get('ct', null),
    vault: store.get('vault', defaultVault()),
    vaultTab: 'in',
    hugDeposit: {},
    fee: { deposit: 18000, rent: 0 },
    manual: { type: '다세대', official: 18000, deposit: 20000, debt: 3000, seniorLease: 0 },
  };

  /* ---------- 메모이즈된 엔진 결과 ---------- */
  const memo = {};
  const L = (id) => ZJ.LISTINGS.find((l) => l.id === id);
  function diag(l) { return memo[l.id] || (memo[l.id] = E.diagnose(l, E.estimate(l))); }
  const LV = [
    { key: 'safe', label: '안전', long: '안심 매물' },
    { key: 'warn', label: '주의', long: '확인 필요' },
    { key: 'danger', label: '위험', long: '계약 비권장' },
  ];

  /* ---------- 아이콘 ---------- */
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.01"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    heart: '<path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    building: '<path d="M4 21V5l8-2v18M12 8l8 2v11M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01M2 21h20"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="m7 15 4-4 3 3 5-6"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    hash: '<path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    won: '<path d="M4 6l3 12 3-9 2 0 3 9 3-12M3 10h18M3 14h18"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  };
  const ic = (n, s = 20, cls = '') => `<svg class="ic ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

  /* ---------- 공통 UI ---------- */
  function toast(msg, kind = '') {
    const t = $('#toast');
    t.className = 'toast show ' + kind; t.textContent = msg;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = 'toast'), 2200);
  }
  function modal(html) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-bg" data-act="closeModal"></div><div class="modal-sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
    root.classList.add('open');
  }
  function closeModal() { const r = $('#modal-root'); r.classList.remove('open'); r.innerHTML = ''; }

  function topbar(title, opts = {}) {
    return `<header class="topbar ${opts.cls || ''}">
      ${opts.back ? `<button class="icon-btn" data-act="back" aria-label="뒤로">${ic('back', 24)}</button>` : '<span class="tb-spacer"></span>'}
      <h1>${title}</h1>
      ${opts.right || '<span class="tb-spacer"></span>'}
    </header>`;
  }
  const badge = (lv, txt) => `<span class="badge ${LV[lv].key}">${txt || LV[lv].label}</span>`;
  const priceText = (l) => (l.deal === '월세' ? `월세 ${E.fmtMan(l.deposit)}/${l.rent}` : `전세 ${E.fmtMan(l.deposit)}`);
  const pyeong = (m2) => (m2 / 3.3058).toFixed(1);
  const fmtDate = (d) => { const x = new Date(d); return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`; };
  const fmtDT = (d) => { const x = new Date(d); return `${fmtDate(x)} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}:${String(x.getSeconds()).padStart(2, '0')}`; };
  const shortHash = (h) => (h ? h.slice(0, 8) + '…' + h.slice(-6) : '-');

  function facade(l, cls = '') {
    const h = l.hue, floors = Math.min(l.floors, 6);
    const top = 136 - floors * 18 - 8;
    let wins = '';
    for (let f = 0; f < floors; f++) for (let c = 0; c < 3; c++) {
      const lit = E.seedOf(l.id + f + c) % 3 === 0;
      wins += `<rect x="${44 + c * 26}" y="${136 - (f + 1) * 18 + 3}" width="16" height="10" rx="1.5" fill="${lit ? '#FFE7A0' : 'rgba(255,255,255,.78)'}"/>`;
    }
    return `<svg class="facade ${cls}" viewBox="0 0 160 160" preserveAspectRatio="${cls === 'big' ? 'xMidYMax meet' : 'xMidYMid slice'}" aria-hidden="true">
      <rect width="160" height="160" fill="hsl(${h},55%,92%)"/>
      <circle cx="128" cy="34" r="14" fill="hsl(${(h + 40) % 360},70%,86%)"/>
      <rect x="32" y="${top}" width="96" height="${136 - top}" rx="3" fill="hsl(${h},28%,62%)"/>
      <rect x="32" y="${top}" width="96" height="6" rx="2" fill="hsl(${h},28%,48%)"/>
      ${wins}
      <rect x="72" y="122" width="16" height="14" rx="1.5" fill="hsl(${h},30%,38%)"/>
      <rect y="136" width="160" height="24" fill="hsl(${h},18%,84%)"/>
      <rect x="10" y="118" width="6" height="18" rx="3" fill="hsl(120,30%,60%)"/><circle cx="13" cy="114" r="9" fill="hsl(120,35%,66%)"/>
    </svg>`;
  }

  /* ---------- 홈 (지도 + 목록) ---------- */
  function filtered() {
    const f = state.filters, q = f.q.trim();
    return ZJ.LISTINGS.filter((l) => {
      if (f.deal !== 'all' && l.deal !== f.deal) return false;
      if (f.room !== 'all' && (f.room === '오피스텔' ? l.type !== '오피스텔' : l.rooms !== f.room)) return false;
      if (f.safeOnly && diag(l).level > 0) return false;
      if (q && !(l.name + l.addr + l.dong + l.type).includes(q)) return false;
      return true;
    });
  }

  function mapSvg() {
    return `<svg class="map-svg" viewBox="0 0 400 260" preserveAspectRatio="none" aria-hidden="true">
      <rect width="400" height="260" fill="#EEF0EA"/>
      <path d="M300 260 C310 215 345 190 400 196 V260z" fill="#D3EACB"/>
      <path d="M0 0 H70 C60 30 30 38 0 36z" fill="#DDEFD6"/>
      <g fill="#E4E6E1">${Array.from({ length: 34 }, (_, i) => { const r = E.rng(i + 7); return `<rect x="${(r() * 380).toFixed(0)}" y="${(r() * 240).toFixed(0)}" width="${(10 + r() * 22).toFixed(0)}" height="${(8 + r() * 14).toFixed(0)}" rx="2"/>`; }).join('')}</g>
      <path d="M0 150 C70 128 120 168 190 140 S320 120 400 150" stroke="#C9E2F5" stroke-width="9" fill="none"/>
      <g stroke="#fff" stroke-linecap="round" fill="none">
        <path d="M0 100 C100 95 200 110 400 92" stroke-width="7"/>
        <path d="M120 0 C125 80 110 170 140 260" stroke-width="7"/>
        <path d="M270 0 C260 90 290 170 280 260" stroke-width="6"/>
        <path d="M0 205 C120 200 230 215 330 190" stroke-width="5"/>
        <path d="M40 0 L70 260" stroke-width="4"/>
        <path d="M190 0 L210 260" stroke-width="4"/>
        <path d="M330 0 L360 180" stroke-width="4"/>
      </g>
      <path d="M0 70 L104 57 L180 42 L248 31 L400 14" stroke="#3CB44A" stroke-width="4" fill="none"/>
      <g fill="#fff" stroke="#3CB44A" stroke-width="2.5"><circle cx="104" cy="57" r="4.5"/><circle cx="180" cy="42" r="4.5"/><circle cx="248" cy="31" r="4.5"/></g>
      <g font-size="8.5" font-weight="700" fill="#2D7A35" font-family="Pretendard,sans-serif">
        <text x="84" y="73">신림역</text><text x="162" y="58">봉천역</text><text x="226" y="22">서울대입구역</text>
      </g>
      <g font-size="9" fill="#9AA3AB" font-family="Pretendard,sans-serif" font-weight="600">
        <text x="40" y="128">신림동</text><text x="218" y="88">봉천동</text><text x="20" y="84">서원동</text><text x="318" y="182">남현동</text>
        <text x="150" y="160" fill="#7FB2D9">도림천</text><text x="345" y="236" fill="#6FA368">관악산</text>
      </g>
    </svg>`;
  }

  function markerHtml(l) {
    const d = diag(l);
    const sel = state.selected === l.id;
    return `<button class="marker ${LV[d.level].key} ${sel ? 'sel' : ''}" style="left:${l.x}%;top:${l.y}%" data-act="pick" data-arg="${l.id}" aria-label="${esc(l.name)} ${priceText(l)}">
      <span class="m-dot"></span><b>${E.shortPrice(l)}</b><small>${l.rooms}</small>
    </button>`;
  }

  function cardHtml(l) {
    const d = diag(l), est = d.est;
    const gap = est.gapPct;
    const gapTag = Math.abs(gap) < 0.03 ? '<span class="tag">시세 적정</span>' : gap < 0 ? `<span class="tag good">시세 대비 ${E.pct(gap)}</span>` : `<span class="tag bad">시세 대비 +${E.pct(gap)}</span>`;
    const hugTag = d.hug.pass ? '<span class="tag good">HUG 가입가능</span>' : '<span class="tag bad">HUG 불가</span>';
    const fav = state.favs.includes(l.id);
    return `<article class="card ${state.selected === l.id ? 'sel' : ''}" id="card-${l.id}" data-go="#/listing/${l.id}">
      <div class="thumb">${facade(l)}<span class="thumb-badge ${LV[d.level].key}">${ic(d.level ? 'alert' : 'shield', 12)}${LV[d.level].long}</span></div>
      <div class="info">
        <div class="price">${priceText(l)}</div>
        <div class="meta">${l.rooms} · ${l.floor}층 · ${l.area}㎡ · 관리비 ${l.fee}만</div>
        <div class="addr">${l.dong} ${esc(l.name)}</div>
        <div class="tags">${hugTag}${gapTag}${l.landlordVerified ? '<span class="tag blue">집주인 인증</span>' : ''}</div>
      </div>
      <button class="fav ${fav ? 'on' : ''}" data-act="fav" data-arg="${l.id}" aria-label="찜">${ic('heart', 20)}</button>
    </article>`;
  }

  function viewHome() {
    const f = state.filters;
    const chip = (key, val, label) => `<button class="chip ${f[key] === val ? 'on' : ''}" data-act="filter" data-key="${key}" data-val="${val}">${label}</button>`;
    return `<div class="home">
      <div class="home-top">
        <div class="brand">${logo()}<span>집지킴</span><em>360</em></div>
        <button class="icon-btn" data-act="noti" aria-label="알림">${ic('bell', 22)}${state.care ? '<i class="dot"></i>' : ''}</button>
      </div>
      <label class="search">${ic('search', 18)}<input id="q" type="search" placeholder="동네, 역, 건물명 검색 (예: 신림, 봉천)" value="${esc(f.q)}" autocomplete="off"></label>
      <div class="chips">
        ${chip('deal', 'all', '전체')}${chip('deal', '전세', '전세')}${chip('deal', '월세', '월세')}
        <span class="chip-sep"></span>
        ${chip('room', '원룸', '원룸')}${chip('room', '투룸', '투룸')}${chip('room', '쓰리룸', '쓰리룸+')}${chip('room', '오피스텔', '오피스텔')}
        <button class="chip safe ${f.safeOnly ? 'on' : ''}" data-act="safeOnly">${ic('shield', 14)}안심매물만</button>
      </div>
      <div class="map-wrap" id="map">
        <div class="map-layer" id="map-layer">${mapSvg()}<div id="markers"></div></div>
        <div class="map-legend"><span><i class="safe"></i>안전</span><span><i class="warn"></i>주의</span><span><i class="danger"></i>위험</span></div>
        <div class="map-note">${ic('layers', 14)}관악구 · 데모 지도</div>
      </div>
      <div class="list-head" id="list-head"></div>
      <div class="list" id="home-list"></div>
    </div>`;
  }
  function refreshHomeList() {
    const items = filtered();
    const safeN = items.filter((l) => diag(l).level === 0).length;
    $('#markers').innerHTML = items.map(markerHtml).join('');
    $('#list-head').innerHTML = `<b>매물 ${items.length}개</b><span>안심 ${safeN} · 주의/위험 ${items.length - safeN}</span>`;
    $('#home-list').innerHTML = items.length ? items.map(cardHtml).join('') : `<div class="empty">${ic('search', 28)}<p>조건에 맞는 매물이 없어요</p><button class="btn ghost sm" data-act="resetFilter">필터 초기화</button></div>`;
  }
  function initMap() {
    const wrap = $('#map'), layer = $('#map-layer');
    if (!wrap) return;
    let pos = state.mapPos || null;
    const bounds = () => ({ w: wrap.clientWidth, h: wrap.clientHeight, lw: layer.offsetWidth, lh: layer.offsetHeight });
    const clamp = (p) => { const b = bounds(); return { x: Math.min(0, Math.max(b.w - b.lw, p.x)), y: Math.min(0, Math.max(b.h - b.lh, p.y)) }; };
    const apply = () => { layer.style.transform = `translate(${pos.x}px,${pos.y}px)`; state.mapPos = pos; };
    if (!pos) { const b = bounds(); pos = { x: (b.w - b.lw) / 2, y: (b.h - b.lh) / 2 }; }
    pos = clamp(pos); apply();
    let start = null;
    wrap.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, moved: false }; });
    wrap.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) > 6) { start.moved = true; wrap.setPointerCapture(e.pointerId); wrap.classList.add('dragging'); }
      if (start.moved) { pos = clamp({ x: start.px + dx, y: start.py + dy }); apply(); }
    });
    const end = (e) => { if (start && start.moved) { state.mapDragged = Date.now(); } start = null; wrap.classList.remove('dragging'); };
    wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
  }

  /* ---------- 매물 상세 ---------- */
  function compChart(l, est) {
    const W = 340, H = 180, pd = { l: 40, r: 10, t: 12, b: 24 };
    const vals = est.comps.map((c) => c.adjusted).concat([est.saleLow, est.saleHigh, est.jeonse, est.askJeonse]);
    const min = Math.min(...vals) * 0.93, max = Math.max(...vals) * 1.04;
    const x = (m) => pd.l + ((11 - m) / 11) * (W - pd.l - pd.r);
    const y = (v) => pd.t + (1 - (v - min) / (max - min)) * (H - pd.t - pd.b);
    const ticks = [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3);
    const now = C.TODAY;
    const months = [11, 8, 5, 2, 0].map((m) => { const d = new Date(now); d.setMonth(d.getMonth() - m); return { m, label: m === 0 ? '현재' : `${d.getMonth() + 1}월` }; });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 12개월 실거래 밴드">
      ${ticks.map((t) => `<line x1="${pd.l}" x2="${W - pd.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pd.l - 6}" y="${y(t) + 3}" text-anchor="end" class="axis">${(t / 10000).toFixed(1)}억</text>`).join('')}
      ${months.map((mo) => `<text x="${x(mo.m)}" y="${H - 6}" text-anchor="middle" class="axis">${mo.label}</text>`).join('')}
      <rect x="${pd.l}" width="${W - pd.l - pd.r}" y="${y(est.saleHigh)}" height="${y(est.saleLow) - y(est.saleHigh)}" class="band"/>
      <line x1="${pd.l}" x2="${W - pd.r}" y1="${y(est.sale)}" y2="${y(est.sale)}" class="sale-line"/>
      <line x1="${pd.l}" x2="${W - pd.r}" y1="${y(est.jeonse)}" y2="${y(est.jeonse)}" class="jeonse-line"/>
      <line x1="${pd.l}" x2="${W - pd.r}" y1="${y(est.askJeonse)}" y2="${y(est.askJeonse)}" class="ask-line"/>
      ${est.comps.map((c) => `<circle cx="${x(c.monthsAgo) + ((c.dist % 7) - 3)}" cy="${y(c.adjusted)}" r="4" class="pt"><title>${c.monthsAgo}개월 전 · ${c.dist}m · ${c.floor}층 · ${c.year}년 → 보정 ${E.fmtMan(c.adjusted)}</title></circle>`).join('')}
    </svg>
    <div class="legend"><span><i class="lg-pt"></i>실거래(대상 호실 보정)</span><span><i class="lg-band"></i>AI 매매 적정범위</span><span><i class="lg-jeonse"></i>AI 적정 전세</span><span><i class="lg-ask"></i>호가${l.deal === '월세' ? '(전세환산)' : ''}</span></div>`;
  }

  function rangeBar(lo, hi, val, labelVal) {
    const min = Math.min(lo, val) * 0.9, max = Math.max(hi, val) * 1.08;
    const p = (v) => ((v - min) / (max - min)) * 100;
    return `<div class="rangebar">
      <div class="rb-track"><div class="rb-fair" style="left:${p(lo)}%;width:${p(hi) - p(lo)}%"></div>
      <div class="rb-pin" style="left:${p(val)}%"><span>${labelVal}</span></div></div>
      <div class="rb-labels"><span style="left:${p(lo)}%">${E.fmtMan(lo)}</span><span style="left:${p(hi)}%">${E.fmtMan(hi)}</span></div>
    </div>`;
  }

  function viewListing(id) {
    const l = L(id); if (!l) return viewNotFound();
    const d = diag(l), est = d.est, h = d.hug;
    const fee = E.brokerFee(l.deposit, l.rent);
    const saving = fee.withVat - 39000;
    const fav = state.favs.includes(l.id);
    const gap = est.gapPct;
    const spec = [
      ['전용면적', `${l.area}㎡ (${pyeong(l.area)}평)`], ['해당층/전체', `${l.floor}층 / ${l.floors}층`],
      ['사용승인', `${l.year}년 (${C.TODAY.getFullYear() - l.year}년차)`], ['주용도', l.type === '근린생활시설' ? '제2종 근린생활시설' : l.type === '오피스텔' ? '업무시설(오피스텔)' : `공동주택(${l.type})`],
      ['승강기', l.elevator ? `${l.elevator}대` : '없음'], ['주차', `${l.parking}대`],
    ];
    return `<div class="detail">
      <div class="hero" style="background:linear-gradient(hsl(${l.hue},55%,92%) 85%, hsl(${l.hue},18%,84%) 85%)">${facade(l, 'big')}
        <div class="hero-bar">
          <button class="icon-btn glass" data-act="back" aria-label="뒤로">${ic('back', 22)}</button>
          <div><button class="icon-btn glass fav ${fav ? 'on' : ''}" data-act="fav" data-arg="${l.id}" aria-label="찜">${ic('heart', 20)}</button></div>
        </div>
        <span class="hero-count">1 / 8</span>
      </div>
      <aside class="d-side">
      <section class="d-head">
        <div class="d-type">${l.type} · ${l.deal} · 매물번호 ZJ-${l.id.toUpperCase()}${(4821 + l.x * 7)}</div>
        <div class="d-price">${priceText(l)}</div>
        <div class="d-addr">${esc(l.addr)} · ${esc(l.name)}</div>
        <div class="tags">${l.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}${l.landlordVerified ? '<span class="tag blue">집주인 본인인증</span>' : '<span class="tag">집주인 미인증</span>'}</div>
      </section>

      <button class="verdict ${LV[d.level].key}" data-go="#/check/${l.id}">
        <div class="v-score"><b>${d.score}</b><small>안심점수</small></div>
        <div class="v-body"><strong>${LV[d.level].long}</strong><span>${d.items.filter((i) => i.level).map((i) => i.title).slice(0, 2).join(' · ') || 'HUG 가입 가능 · 위험 권리 없음'}</span></div>
        ${ic('right', 20)}
      </button>
      <section class="sec save">
        <div class="save-row"><div><small>공인중개사 법정 상한 중개보수</small><s>${E.fmtWon(fee.withVat)}</s></div>
        <div><small>집지킴 안심 직거래</small><b>39,000원</b></div></div>
        <p>${saving > 0 ? `최대 <b>${E.fmtWon(saving)}</b> 절약 · ` : ''}거래금액 ${E.fmtMan(fee.base)} × ${(fee.rate * 100).toFixed(1)}% (VAT 포함, 일방)</p>
      </section>
      <div class="cta-bar">
        <button class="btn line" data-go="#/check/${l.id}">${ic('shield', 18)}안심진단</button>
        <button class="btn primary" data-act="startContract" data-arg="${l.id}">${ic('doc', 18)}직거래 계약하기</button>
      </div>
      </aside>
      <div class="d-main">
      <section class="sec">
        <div class="sec-h"><h3>${ic('sparkle', 18)}AI 정밀 시세</h3><span class="muted sm">신뢰도 ${est.confidence}% · 비교사례 ${est.comps.length}건</span></div>
        <div class="kv2">
          <div><small>적정 전세</small><b>${E.fmtMan(est.jeonseLow)}~${E.fmtMan(est.jeonseHigh)}</b></div>
          <div><small>적정 매매</small><b>${E.fmtMan(est.sale)}</b></div>
        </div>
        ${rangeBar(est.jeonseLow, est.jeonseHigh, est.askJeonse, l.deal === '월세' ? '호가(환산)' : '호가')}
        <div class="gap-note ${gap > 0.05 ? 'bad' : gap < -0.03 ? 'good' : ''}">
          ${l.deal === '월세' ? `전세환산 ${E.fmtMan(est.askJeonse)} 기준 ` : ''}호가가 AI 적정가 대비 <b>${gap >= 0 ? '+' : ''}${E.pct(gap, 1)}</b> ${gap > 0.05 ? '프리미엄 — 협상 여지 있음' : gap < -0.03 ? '디스카운트 — 저렴한 이유(권리·하자)를 꼭 확인하세요' : '적정 수준'}
        </div>
        ${l.deal === '월세' ? `<div class="mini-grid">
          <div><small>시장 전환율</small><b>${est.marketRate}%</b></div>
          <div><small>법정 상한(갱신 시)</small><b>${est.legalRate.toFixed(1)}%</b></div>
          <div><small>적정 월세</small><b>${est.fairRent}만</b></div></div>` : ''}
        <div class="chart-box">${compChart(l, est)}</div>
        <details class="fold"><summary>반경 500m 비교 실거래 ${est.comps.length}건 보기</summary>
          <table class="tbl"><thead><tr><th>시점</th><th>거리</th><th>층/연식</th><th>면적</th><th>거래가</th><th>보정가</th></tr></thead><tbody>
          ${est.comps.slice().sort((a, b) => a.monthsAgo - b.monthsAgo).map((c) => `<tr><td>${c.monthsAgo ? c.monthsAgo + '개월 전' : '이번 달'}</td><td>${c.dist}m</td><td>${c.floor || '반지하'}층·${c.year}</td><td>${c.area}㎡</td><td>${E.fmtMan(c.price)}</td><td><b>${E.fmtMan(c.adjusted)}</b></td></tr>`).join('')}
          </tbody></table>
          <p class="fine">헤도닉 보정: 층(1층 -7%, 반지하 -20%, 탑층 -3%), 연식(±0.8%/년), 승강기(+4%), 위반건축물(-18%), 시점(+0.2%/월). 거리·시점 역가중 평균. 데모 데이터입니다.</p>
        </details>
      </section>

      <section class="sec">
        <div class="sec-h"><h3>${ic('building', 18)}건축물대장 표제부</h3><span class="muted sm">국토부 API 연동 예정</span></div>
        ${l.violation ? `<div class="alert danger">${ic('alert', 18)}<div><b>위반건축물</b><p>${esc(l.violationNote)}. HUG 보증 및 전세대출이 거절됩니다.</p></div></div>` : ''}
        <div class="spec">${spec.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
      </section>

      <section class="sec">
        <div class="sec-h"><h3>${ic('shield', 18)}HUG 126% 간이 진단</h3></div>
        <div class="hug-mini ${h.pass ? 'ok' : 'no'}">
          <div><small>보증 한도 (${h.priceBasis.split('(')[0]} × 126%)</small><b>${E.fmtMan(h.limit)}</b></div>
          <div><small>보증금 + 선순위</small><b>${E.fmtMan(h.total)}</b></div>
          <div><small>안전 최대 보증금</small><b>${E.fmtMan(h.maxSafeDeposit)}</b></div>
        </div>
        <button class="btn ghost block" data-go="#/check/${l.id}">정밀 진단 리포트 보기 ${ic('right', 16)}</button>
      </section>

      </div>
      <div class="bottom-pad"></div>
    </div>`;
  }

  /* ---------- 안심 진단 ---------- */
  function gauge(score, lv) {
    const a = Math.PI * (1 - score / 100);
    const x = 100 + 80 * Math.cos(a), y = 100 - 80 * Math.sin(a);
    return `<svg class="gauge" viewBox="0 0 200 116" aria-label="안심점수 ${score}">
      <path d="M20 100 A80 80 0 0 1 180 100" class="g-track"/>
      <path d="M20 100 A80 80 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" class="g-val ${LV[lv].key}"/>
      <text x="100" y="88" text-anchor="middle" class="g-num">${score}</text>
      <text x="100" y="108" text-anchor="middle" class="g-lbl">/ 100</text>
    </svg>`;
  }
  function hugBlock(l, deposit) {
    const h = E.hug(l, deposit);
    const scale = Math.max(h.limit, h.total) * 1.12;
    const w = (v) => (v / scale) * 100;
    const ok = h.pass;
    return `<div class="hug-bar">
        <div class="hb-track">
          ${h.debt ? `<div class="hb-seg hb-debt" style="width:${w(h.debt)}%" title="선순위 채권최고액"></div>` : ''}
          ${h.seniorLease ? `<div class="hb-seg hb-lease" style="width:${w(h.seniorLease)}%" title="선순위 임차보증금"></div>` : ''}
          <div class="hb-seg hb-dep ${ok ? '' : 'over'}" style="width:${w(h.deposit)}%" title="보증금"></div>
          <div class="hb-limit" style="left:${w(h.limit)}%"><span>한도 ${E.fmtMan(h.limit)}</span></div>
        </div>
        <div class="hb-legend">${h.debt ? `<span><i class="hb-debt"></i>근저당 ${E.fmtMan(h.debt)}</span>` : ''}${h.seniorLease ? `<span><i class="hb-lease"></i>선순위보증금 ${E.fmtMan(h.seniorLease)}</span>` : ''}<span><i class="hb-dep"></i>보증금 ${E.fmtMan(h.deposit)}</span></div>
      </div>
      <div class="formula">
        <div><span>${h.priceBasis}</span><b>${E.fmtMan(l.officialPrice)}</b></div>
        <div><span>× 126% (주택가격 140% × 담보인정 90%)</span><b>= ${E.fmtMan(h.limit)}</b></div>
        <div><span>선순위 합계 (채권최고액${h.seniorLease ? ' + 선순위 보증금' : ''})</span><b>− ${E.fmtMan(h.senior)}</b></div>
        <div class="sum"><span>보증 가능한 최대 보증금</span><b>${E.fmtMan(h.maxSafeDeposit)}</b></div>
      </div>
      <div class="result ${ok ? 'ok' : 'no'}">${ic(ok ? 'check' : 'alert', 18)}${l.violation ? '위반건축물 — 금액과 무관하게 가입 불가' : ok ? `보증 가입 가능 (여유 ${E.fmtMan(h.limit - h.total)})` : `보증 가입 불가 — ${E.fmtMan(h.total - h.limit)} 초과`}${!ok && h.depositOnlyPass && !l.violation ? '<em>보증금만 보면 통과하지만 선순위 채권 합산 시 탈락하는 케이스</em>' : ''}</div>`;
  }

  function viewCheck(id) {
    if (!id) return viewCheckHub();
    const l = L(id); if (!l) return viewNotFound();
    const d = diag(l);
    const unlocked = state.unlocked.includes(l.id);
    const dep = state.hugDeposit[l.id] != null ? state.hugDeposit[l.id] : l.deposit;
    const sliderMax = Math.max(Math.round(E.hug(l).limit * 1.3 / 500) * 500, l.deposit + 5000);
    const recs = ZJ.CLAUSES.filter((c) => c.id !== 'c6' || l.type === '다가구');
    return `${topbar('안심 진단 리포트', { back: true })}
    <div class="page">
      <section class="sec center">
        <div class="muted sm">${esc(l.addr)} · ${esc(l.name)}</div>
        ${gauge(d.score, d.level)}
        <div class="v-title">${badge(d.level, LV[d.level].long)}</div>
        <p class="muted sm">진단 기준일 ${fmtDate(C.TODAY)} · 데모 데이터</p>
      </section>

      <section class="sec">
        <div class="sec-h"><h3>HUG 전세보증 126% 판정</h3></div>
        <div id="hug-block">${hugBlock(l, dep)}</div>
        <label class="slider-label">희망 보증금 시뮬레이션 <b id="dep-val">${E.fmtMan(dep)}</b></label>
        <input type="range" class="slider" min="0" max="${sliderMax}" step="500" value="${dep}" data-input="hugDeposit" data-arg="${l.id}">
      </section>

      <section class="sec">
        <div class="sec-h"><h3>8대 위험 체크리스트</h3><span class="muted sm">${d.items.filter((i) => i.level === 0).length}/${d.items.length} 통과</span></div>
        <ul class="checklist">${d.items.map((i) => `<li class="${LV[i.level].key}"><span class="ck">${ic(i.level ? 'alert' : 'check', 16)}</span><div><b>${i.title}</b><p>${esc(i.detail)}</p></div>${badge(i.level)}</li>`).join('')}</ul>
      </section>

      <section class="sec ${unlocked ? '' : 'locked'}">
        <div class="sec-h"><h3>등기사항전부증명서 권리분석</h3><span class="muted sm">인터넷등기소 연계 예정</span></div>
        <div class="${unlocked ? '' : 'blur'}">
          <h4 class="sub">갑구 (소유권)</h4>
          <table class="tbl"><thead><tr><th>접수일</th><th>등기목적</th><th>원인</th><th>권리자</th></tr></thead><tbody>
          ${l.gap.map((g) => `<tr class="${g.flag ? 'hl' : ''}"><td>${fmtDate(g.date)}</td><td>${g.type}</td><td>${g.cause}</td><td>${esc(g.who)}</td></tr>`).join('')}</tbody></table>
          <h4 class="sub">을구 (소유권 외 권리)</h4>
          ${l.eul.length ? `<table class="tbl"><thead><tr><th>접수일</th><th>등기목적</th><th>채권최고액</th><th>권리자</th></tr></thead><tbody>
          ${l.eul.map((e) => `<tr class="hl"><td>${fmtDate(e.date)}</td><td>${e.type}</td><td>${E.fmtMan(e.amount)}</td><td>${esc(e.who)}</td></tr>`).join('')}</tbody></table>
          <p class="fine">채권최고액은 실제 대출액의 통상 120~130%. 경매 시 보증금보다 먼저 배당됩니다.</p>` : '<p class="muted sm pad">기록사항 없음 — 근저당·전세권 설정 없음</p>'}
          <div class="ratio-box"><span>총 부채비율 (보증금+선순위 ÷ 시세)</span><b class="${d.ratio > 0.8 ? 'c-danger' : d.ratio > 0.7 ? 'c-warn' : 'c-safe'}">${E.pct(d.ratio)}</b></div>
        </div>
        ${unlocked ? '' : `<div class="lock-cta">${ic('lock', 22)}<b>정밀 권리분석 리포트</b><p>갑구·을구 원문 파싱, 부채비율, 맞춤 특약</p>
          <button class="btn primary" data-act="unlock" data-arg="${l.id}">${state.freeUsed ? '4,900원 결제하고 열기' : '첫 1회 무료로 열기'}</button></div>`}
      </section>

      <section class="sec ${unlocked ? '' : 'locked'}">
        <div class="sec-h"><h3>안심 특약 ${recs.length}종</h3>${unlocked ? `<button class="link" data-act="copyAll" data-arg="${l.id}">${ic('copy', 15)}전체 복사</button>` : ''}</div>
        <div class="${unlocked ? '' : 'blur'}">
          ${recs.map((c, i) => `<div class="clause"><div class="cl-h"><b>특약 ${i + 1}. ${c.title}</b><button class="icon-btn sm" data-act="copy" data-arg="${c.id}" aria-label="복사">${ic('copy', 16)}</button></div><p>${c.text}</p></div>`).join('')}
          <p class="fine">※ 데모 문구입니다. 실서비스 탑재 전 변호사 감수를 받아야 하며, 개별 사안에 대한 법률 자문이 아닙니다.</p>
        </div>
      </section>

      <section class="sec care">
        <div><b>${ic('bell', 18)}2년 안심케어 · 등기 실시간 감시</b><p>계약 후 거주 기간 동안 근저당·압류·소유권 변동을 매일 확인해 알림톡으로 알려드려요.</p></div>
        <button class="btn ${state.care ? 'line' : 'primary'} sm" data-act="toggleCare">${state.care ? '구독 중' : '월 1,900원'}</button>
      </section>
      <div class="cta-inline"><button class="btn primary block" data-act="startContract" data-arg="${l.id}">${ic('doc', 18)}이 집으로 안심 직거래 계약 시작</button></div>
    </div>`;
  }

  function viewCheckHub() {
    const m = state.manual;
    return `${topbar('안심 진단')}
    <div class="page">
      <section class="hero-card">
        <h2>이 전세, 보증보험 가입될까?</h2>
        <p>공시가 × 126% 한도에서 <b>근저당·선순위 보증금까지 합산</b>해 판정해요.</p>
      </section>
      <section class="sec">
        <div class="sec-h"><h3>직접 입력 계산기</h3><span class="muted sm">단위: 만원</span></div>
        <div class="form">
          <label>주택 유형<select data-input="manual" data-key="type">${['다세대', '연립', '다가구', '오피스텔'].map((t) => `<option ${m.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label>${m.type === '오피스텔' ? '국세청 기준시가' : m.type === '다가구' ? '개별단독주택 공시가 (건물 전체)' : '공동주택 공시가격'}<input type="number" inputmode="numeric" value="${m.official}" data-input="manual" data-key="official"></label>
          <label>희망 보증금<input type="number" inputmode="numeric" value="${m.deposit}" data-input="manual" data-key="deposit"></label>
          <label>선순위 근저당 채권최고액 (등기부 을구)<input type="number" inputmode="numeric" value="${m.debt}" data-input="manual" data-key="debt"></label>
          ${m.type === '다가구' ? `<label>선순위 임차보증금 합계<input type="number" inputmode="numeric" value="${m.seniorLease}" data-input="manual" data-key="seniorLease"></label>` : ''}
        </div>
        <div id="manual-result">${manualResult()}</div>
      </section>
      <section class="sec">
        <div class="sec-h"><h3>주변 매물 바로 진단</h3></div>
        <div class="rows">${ZJ.LISTINGS.map((l) => { const d = diag(l); return `<button class="row" data-go="#/check/${l.id}"><div><b>${esc(l.name)}</b><small>${l.dong} · ${priceText(l)}</small></div>${badge(d.level)}${ic('right', 16, 'muted')}</button>`; }).join('')}</div>
      </section>
    </div>`;
  }
  function manualResult() {
    const m = state.manual;
    const pseudo = { type: m.type, officialPrice: +m.official || 0, eul: m.debt ? [{ type: '근저당권설정', amount: +m.debt }] : [], seniorLease: m.type === '다가구' ? +m.seniorLease || 0 : 0, violation: false };
    return hugBlock(pseudo, +m.deposit || 0);
  }

  /* ---------- 안심 직거래 계약 ---------- */
  const CT_STEPS = ['본인인증', '계약조건', '안심특약', '서명·봉인', '에스크로'];
  function newContract(l) {
    const d = diag(l);
    const bal = '2026-11-30';
    return {
      listingId: l.id, step: 0, tenantOk: false, landlordOk: l.landlordVerified, riskAck: d.level < 2,
      form: { tenant: '김민수', deposit: l.deposit, rent: l.rent, down: Math.round(l.deposit * 0.1), balanceDate: bal, start: bal, months: 24, escrowAll: true, daepil: false },
      clauses: ZJ.CLAUSES.filter((c) => c.id !== 'c6' || l.type === '다가구').map((c) => c.id),
      sig: null, hash: null, tsa: null, sealedAt: null,
      escrow: { stage: 0, alert: false, log: [] },
    };
  }
  function saveCt() { store.set('ct', state.ct); }

  function viewContract(id) {
    let ct = state.ct;
    if (id && (!ct || ct.listingId !== id)) { state.ct = ct = newContract(L(id)); saveCt(); }
    if (!ct) {
      return `${topbar('안심 직거래')}
      <div class="page">
        <section class="hero-card blue"><h2>복비 대신 39,000원</h2><p>본인인증 · 표준 전자계약 · 은행 에스크로 · 등기 감시까지 한 번에.</p></section>
        <section class="sec"><div class="steps-intro">${CT_STEPS.map((s, i) => `<div><span>${i + 1}</span>${s}</div>`).join('')}</div></section>
        <section class="sec"><div class="sec-h"><h3>계약할 매물 선택</h3></div>
          <div class="rows">${ZJ.LISTINGS.map((l) => { const d = diag(l); return `<button class="row" data-act="startContract" data-arg="${l.id}"><div><b>${esc(l.name)}</b><small>${priceText(l)} · ${l.landlordVerified ? '집주인 인증완료' : '집주인 미인증'}</small></div>${badge(d.level)}${ic('right', 16, 'muted')}</button>`; }).join('')}</div>
        </section>
      </div>`;
    }
    const l = L(ct.listingId);
    const body = [ctAuth, ctTerms, ctClauses, ctSign, ctEscrow][ct.step](l, ct);
    return `${topbar('안심 직거래 계약', { back: true, right: `<button class="link sm" data-act="resetContract">처음부터</button>` })}
      <div class="stepper">${CT_STEPS.map((s, i) => `<div class="st ${i < ct.step ? 'done' : i === ct.step ? 'cur' : ''}"><span>${i < ct.step ? ic('check', 12) : i + 1}</span><small>${s}</small></div>`).join('')}</div>
      <div class="page ct">
        <div class="ct-target">${facade(l, 'mini')}<div><b>${esc(l.name)}</b><small>${priceText(l)} · ${esc(l.addr)}</small></div>${badge(diag(l).level)}</div>
        ${body}
      </div>`;
  }

  function ctAuth(l, ct) {
    const trust = l.ownerType === '신탁회사';
    const corp = /법인/.test(l.ownerType);
    const d = diag(l);
    const canNext = ct.tenantOk && ct.landlordOk && !trust && ct.riskAck;
    return `<section class="sec">
      <div class="sec-h"><h3>당사자 실명인증</h3></div>
      <div class="party"><div><small>임차인 (나)</small><b>${ct.tenantOk ? esc(ct.form.tenant) + ' · 인증완료' : '인증 필요'}</b></div>
        ${ct.tenantOk ? `<span class="ok-pill">${ic('check', 14)}PASS</span>` : `<div class="btn-row"><button class="btn pass sm" data-act="auth" data-arg="tenant">PASS</button><button class="btn kakao sm" data-act="auth" data-arg="tenant">카카오</button></div>`}</div>
      <div class="party"><div><small>임대인</small><b>${ct.landlordOk ? esc(l.owner) + ' · 인증완료' : '인증 대기'}</b></div>
        ${ct.landlordOk ? `<span class="ok-pill">${ic('check', 14)}인증</span>` : `<button class="btn line sm" data-act="auth" data-arg="landlord">인증 요청 보내기</button>`}</div>
    </section>
    <section class="sec">
      <div class="sec-h"><h3>실소유주 일치 검증</h3></div>
      <div class="match ${trust ? 'no' : 'ok'}">
        <div><small>등기부 갑구 소유자</small><b>${esc(l.owner)}</b><em>${l.ownerType}</em></div>
        <div class="vs">${ic(trust ? 'x' : 'check', 18)}</div>
        <div><small>본인인증 명의</small><b>${ct.landlordOk ? esc(trust ? l.gap[0].who : l.owner) : '-'}</b><em>${trust ? '위탁자' : '임대인'}</em></div>
      </div>
      ${trust ? `<div class="alert danger">${ic('alert', 18)}<div><b>계약 진행 불가</b><p>신탁등기 주택은 등기상 소유자가 신탁회사입니다. 신탁원부 확인 및 신탁사·우선수익자 동의서 없이는 임대차 효력을 주장하기 어렵습니다.</p></div></div>` : ''}
      ${corp && !trust ? `<div class="alert warn">${ic('alert', 18)}<div><b>법인 임대인 추가 확인</b><p>법인등기부·대표자 본인 여부·인감증명서와 법인 보유 주택 수, 최근 명의변경 경위를 반드시 확인하세요.</p></div></div>` : ''}
    </section>
    ${d.level === 2 && !trust ? `<section class="sec"><div class="alert danger">${ic('alert', 18)}<div><b>위험 판정 매물입니다</b><p>${d.items.filter((i) => i.level === 2).map((i) => i.title).join(', ')}. 진행 전 진단 리포트를 확인하세요.</p></div></div>
      <label class="check-row"><input type="checkbox" data-act="riskAck" ${ct.riskAck ? 'checked' : ''}> 위험 내용을 확인했으며 본인 판단으로 진행합니다</label></section>` : ''}
    <div class="ct-nav"><button class="btn primary block" data-act="ctNext" ${canNext ? '' : 'disabled'}>다음</button></div>`;
  }

  function ctTerms(l, ct) {
    const f = ct.form;
    const fee = E.brokerFee(f.deposit, f.rent);
    const total = 39000 + (f.daepil ? 50000 : 0);
    return `<section class="sec form">
      <div class="sec-h"><h3>계약 조건</h3><span class="muted sm">주택임대차표준계약서 기준</span></div>
      <label>임차인 성명<input value="${esc(f.tenant)}" data-input="ctForm" data-key="tenant"></label>
      <div class="grid2">
        <label>보증금 (만원)<input type="number" inputmode="numeric" value="${f.deposit}" data-input="ctForm" data-key="deposit"></label>
        <label>월차임 (만원)<input type="number" inputmode="numeric" value="${f.rent}" data-input="ctForm" data-key="rent"></label>
        <label>계약금 (만원)<input type="number" inputmode="numeric" value="${f.down}" data-input="ctForm" data-key="down"></label>
        <label>잔금일 · 입주일<input type="date" value="${f.balanceDate}" data-input="ctForm" data-key="balanceDate"></label>
      </div>
      <label>계약기간<select data-input="ctForm" data-key="months">${[12, 24].map((m) => `<option value="${m}" ${+f.months === m ? 'selected' : ''}>${m}개월 (${m === 24 ? '주임법 최단기간' : '1년 — 임차인은 2년 주장 가능'})</option>`).join('')}</select></label>
    </section>
    <section class="sec">
      <div class="sec-h"><h3>에스크로 예치 범위</h3></div>
      <label class="radio-card ${!f.escrowAll ? 'on' : ''}"><input type="radio" name="esc" data-act="escrowAll" data-arg="0" ${!f.escrowAll ? 'checked' : ''}><div><b>계약금만 예치</b><p>${E.fmtMan(f.down)}만원 · 대항력 확인 후 정산</p></div></label>
      <label class="radio-card ${f.escrowAll ? 'on' : ''}"><input type="radio" name="esc" data-act="escrowAll" data-arg="1" ${f.escrowAll ? 'checked' : ''}><div><b>계약금 + 잔금 예치 <span class="tag blue">권장</span></b><p>잔금일 당일 근저당 설정 같은 '잔금 사기'까지 차단</p></div></label>
    </section>
    <section class="sec">
      <label class="check-row big"><input type="checkbox" data-act="daepil" ${f.daepil ? 'checked' : ''}><div><b>5만원 안심 대필 (지역 협약 공인중개사)</b><p>비대면이 불안하다면 공인중개사가 계약서를 검수·날인해 드려요.</p></div></label>
    </section>
    <section class="sec bill">
      <div><span>집지킴 전자계약·에스크로 이용료</span><b>39,000원</b></div>
      ${f.daepil ? '<div><span>안심 대필 파트너스</span><b>50,000원</b></div>' : ''}
      <div class="sum"><span>합계</span><b>${E.fmtWon(total)}</b></div>
      <div class="cmp"><span>법정 상한 중개보수 (VAT 포함)</span><s>${E.fmtWon(fee.withVat)}</s></div>
      <p class="fine">이용료는 중개 알선 대가가 아닌 전자문서·에스크로 솔루션 이용료(SaaS)입니다. 집지킴은 가격 협상·알선에 관여하지 않습니다.</p>
    </section>
    <div class="ct-nav two"><button class="btn line" data-act="ctPrev">이전</button><button class="btn primary" data-act="ctNext">다음</button></div>`;
  }

  function ctClauses(l, ct) {
    const list = ZJ.CLAUSES.filter((c) => c.id !== 'c6' || l.type === '다가구');
    return `<section class="sec">
      <div class="sec-h"><h3>안심 특약 선택</h3><span class="muted sm">${ct.clauses.length}개 선택</span></div>
      ${list.map((c) => `<label class="clause pick ${ct.clauses.includes(c.id) ? 'on' : ''}"><input type="checkbox" data-act="clause" data-arg="${c.id}" ${ct.clauses.includes(c.id) ? 'checked' : ''}><div><b>${c.title}</b><p>${c.text}</p></div></label>`).join('')}
      <p class="fine">※ 데모 문구 — 실서비스는 변호사 감수본을 사용합니다.</p>
    </section>
    <div class="ct-nav two"><button class="btn line" data-act="ctPrev">이전</button><button class="btn primary" data-act="ctNext">계약서 확인</button></div>`;
  }

  function contractDoc(l, ct) {
    const f = ct.form;
    const end = new Date(f.start); end.setMonth(end.getMonth() + +f.months); end.setDate(end.getDate() - 1);
    const clauses = ZJ.CLAUSES.filter((c) => ct.clauses.includes(c.id));
    return `<div class="paper">
      <h2>주택임대차 전자계약서</h2>
      <p class="paper-sub">국토교통부 주택임대차표준계약서 양식 준용 · 집지킴 360</p>
      <table class="ptbl">
        <tr><th>소재지</th><td colspan="3">${esc(l.addr)} ${esc(l.name)}</td></tr>
        <tr><th>구조·용도</th><td>${l.type}</td><th>면적</th><td>${l.area}㎡</td></tr>
        <tr><th>보증금</th><td>금 ${E.fmtMan(f.deposit)}만원정</td><th>차임</th><td>${+f.rent ? `월 ${f.rent}만원` : '없음'}</td></tr>
        <tr><th>계약금</th><td>${E.fmtMan(f.down)}만원 (에스크로)</td><th>잔금</th><td>${E.fmtMan(f.deposit - f.down)}만원 · ${fmtDate(f.balanceDate)}</td></tr>
        <tr><th>임대기간</th><td colspan="3">${fmtDate(f.start)} ~ ${fmtDate(end)} (${f.months}개월)</td></tr>
        <tr><th>임대인</th><td>${esc(l.owner)}</td><th>임차인</th><td>${esc(f.tenant)}</td></tr>
      </table>
      <h4>특약사항</h4>
      <ol>${clauses.map((c) => `<li>${c.text}</li>`).join('')}</ol>
      <p class="fine">본 계약은 전자문서 및 전자거래 기본법, 전자서명법에 따라 체결되며 잔금 후 30일 이내 주택임대차 신고(보증금 6천만원 초과 또는 월차임 30만원 초과)가 필요합니다.</p>
    </div>`;
  }

  function ctSign(l, ct) {
    if (ct.hash) {
      return `<section class="sec">
        <div class="sealed">${ic('lock', 28)}<b>계약서 봉인 완료</b><p>${fmtDT(ct.sealedAt)}</p></div>
        ${contractDoc(l, ct)}
        <div class="sig-pair"><div><small>임대인</small><div class="sig-img landlord">${esc(l.owner)}</div></div><div><small>임차인</small><img class="sig-img" src="${ct.sig}" alt="임차인 서명"></div></div>
        <div class="hash-box"><div><small>문서 해시 (SHA-256)</small><code>${ct.hash}</code></div><div><small>시점확인 토큰 (RFC 3161 TSA · 데모)</small><code>${ct.tsa}</code></div></div>
        <button class="btn ghost block sm" data-act="verifyHash">${ic('hash', 16)}무결성 재검증</button>
      </section>
      <div class="ct-nav"><button class="btn primary block" data-act="ctNext">에스크로 가상계좌 발급</button></div>`;
    }
    return `<section class="sec">${contractDoc(l, ct)}</section>
    <section class="sec">
      <div class="sec-h"><h3>임차인 전자서명</h3><button class="link" data-act="clearSig">지우기</button></div>
      <canvas id="sig" class="sig-pad" width="640" height="220" aria-label="서명 입력"></canvas>
      <p class="fine">손가락 또는 마우스로 서명하세요. 임대인은 별도 링크로 서명합니다(데모: 자동 서명).</p>
      <label class="check-row"><input type="checkbox" id="agree"> 계약 내용을 확인했으며 전자서명의 효력에 동의합니다</label>
    </section>
    <div class="ct-nav two"><button class="btn line" data-act="ctPrev">이전</button><button class="btn primary" data-act="seal">서명하고 봉인</button></div>`;
  }

  function escrowStages(ct) {
    const f = ct.form;
    const bal = new Date(f.balanceDate);
    const next = new Date(bal); next.setDate(next.getDate() + 1);
    const s = [
      { t: '가상계좌 발급', d: '제휴 은행 에스크로 전용 계좌' },
      { t: `계약금 ${E.fmtMan(f.down)}만원 예치`, d: '임대인에게 즉시 지급되지 않고 은행에 보관' },
    ];
    if (f.escrowAll) s.push({ t: `잔금 ${E.fmtMan(f.deposit - f.down)}만원 예치`, d: `${fmtDate(bal)} 잔금일` });
    s.push({ t: '입주 · 전입신고 · 확정일자', d: `${fmtDate(bal)} — 정부24/주민센터에서 당일 처리` });
    s.push({ t: '대항력 발생', d: `${fmtDate(next)} 00:00 — 전입신고 다음 날 0시 (주임법 제3조)` });
    s.push({ t: '등기 무변동 확인 → 임대인 정산', d: '대항력 발생 시점까지 근저당 등 변동 없음 확인 후 자동 지급' });
    return s;
  }

  function ctEscrow(l, ct) {
    const es = ct.escrow;
    const stages = escrowStages(ct);
    const done = es.stage >= stages.length - 1;
    const acct = '우리은행 1005-' + (E.seedOf(ct.hash || 'x') % 900 + 100) + '-' + String(E.seedOf(l.id) % 1000000).padStart(6, '0');
    return `<section class="sec">
      <div class="acct"><small>에스크로 가상계좌 (데모)</small><b>${acct}</b><span>예금주: 집지킴에스크로(${esc(l.owner)})</span><button class="link" data-act="copyText" data-arg="${acct}">${ic('copy', 14)}복사</button></div>
      ${es.alert ? `<div class="alert danger pulse">${ic('alert', 20)}<div><b>등기 변동 감지 · 정산 자동 보류</b><p>${fmtDT(es.alertAt)} 을구에 근저당권설정 접수(채권최고액 1억 2,000만원)가 감지되어 알림톡을 발송했습니다. 특약 1에 따라 계약 해제 및 예치금 전액 반환을 청구할 수 있습니다.</p>
        <div class="btn-row"><button class="btn danger sm" data-act="refund">예치금 반환 요청</button><button class="btn line sm" data-act="clearAlert">정상 시나리오로</button></div></div></div>` : ''}
      <ol class="timeline">${stages.map((s, i) => `<li class="${i < es.stage || (done && i === es.stage) ? 'done' : i === es.stage ? 'cur' : ''} ${es.alert && i === es.stage ? 'hold' : ''}"><span class="tl-dot">${i < es.stage || (done && i === es.stage) ? ic('check', 12) : ''}</span><div><b>${s.t}</b><p>${s.d}</p></div></li>`).join('')}</ol>
      ${done ? `<div class="alert ok">${ic('check', 18)}<div><b>거래 완료</b><p>대항력 확보와 등기 무변동이 확인되어 예치금이 임대인에게 정산되었습니다. 30일 내 임대차 신고를 잊지 마세요.</p></div></div>`
        : `<div class="btn-row wide"><button class="btn primary" data-act="escNext" ${es.alert ? 'disabled' : ''}>다음 단계 진행</button><button class="btn danger-line" data-act="escAlert" ${es.alert || es.stage < 1 ? 'disabled' : ''}>근저당 기습 시뮬</button></div>`}
    </section>
    <section class="sec">
      <div class="sec-h"><h3>${ic('eye', 18)}실시간 등기 감시 로그</h3><span class="muted sm">1시간 간격</span></div>
      <p class="fine" style="margin:-6px 0 10px">계약금 예치 시점부터 전입 익일 0시 + 24시간까지 감시</p><ul class="log">${es.log.length ? es.log.slice().reverse().map((g) => `<li class="${g.bad ? 'bad' : ''}"><time>${fmtDT(g.t)}</time><span>${g.msg}</span></li>`).join('') : '<li class="muted">계약금 예치 후 감시가 시작됩니다.</li>'}</ul>
      ${done ? `<div class="care-up"><p>거주 2년 동안도 감시를 이어갈까요?</p><button class="btn ${state.care ? 'line' : 'primary'} sm" data-act="toggleCare">${state.care ? '2년 안심케어 구독 중' : '2년 안심케어 월 1,900원'}</button></div>` : ''}
    </section>
    <section class="sec">
      <div class="sec-h"><h3>다음 할 일</h3></div>
      <div class="rows">
        <button class="row" data-go="#/vault"><div><b>입주 사진 금고 촬영</b><small>12개 체크포인트 · 퇴거 분쟁 대비</small></div>${ic('right', 16, 'muted')}</button>
        <div class="row static"><div><b>주택임대차 신고</b><small>계약 후 30일 이내 · 신고 시 확정일자 자동 부여</small></div></div>
        <div class="row static"><div><b>전세보증금 반환보증 가입</b><small>HUG · HF · SGI — 잔금 후 신청</small></div></div>
      </div>
    </section>`;
  }

  /* ---------- 원상복구 사진 금고 ---------- */
  function allItems() { return ZJ.ZONES.flatMap((z) => z.items.map((it) => ({ ...it, zone: z.name }))); }
  function residenceYears() {
    const v = state.vault;
    return Math.max(0, (new Date(v.moveOut) - new Date(v.moveIn)) / (365.25 * 86400000));
  }
  function viewVault() {
    const v = state.vault, tab = state.vaultTab;
    const inN = Object.keys(v.in).length, outN = Object.keys(v.out).length;
    const tabs = [['in', `입주 기록 ${inN}/12`], ['out', `퇴거 비교 ${outN}/12`], ['dep', '감가상각'], ['rep', '리포트']];
    let body = '';
    if (tab === 'in' || tab === 'out') body = vaultSlots(tab);
    else if (tab === 'dep') body = vaultDeprec();
    else body = vaultReport();
    return `${topbar('사진 금고', { right: `<button class="link sm" data-act="sampleFill">샘플 채우기</button>` })}
      <div class="seg">${tabs.map(([k, t]) => `<button class="${tab === k ? 'on' : ''}" data-act="vaultTab" data-arg="${k}">${t}</button>`).join('')}</div>
      <div class="page">${body}</div>`;
  }
  function vaultSlots(phase) {
    const v = state.vault;
    const n = Object.keys(v[phase]).length;
    const head = phase === 'in'
      ? `<section class="hero-card mint"><h2>입주 첫날, 12컷이면 충분해요</h2><p>사진마다 <b>원본 SHA-256 해시</b>와 수신 시각을 봉인하고, 전체를 머클 루트 하나로 묶어 위·변조를 막아요.</p>
          <div class="progress"><i style="width:${(n / 12) * 100}%"></i></div><small>${n}/12 완료</small></section>`
      : `<section class="hero-card"><h2>퇴거 전, 같은 각도로 다시 찍기</h2><p>입주 사진과 나란히 비교하고 항목별로 <b>자연마모 / 임차인 과실</b>을 판정하세요. 자연마모는 배상 책임이 없습니다.</p></section>`;
    return head + ZJ.ZONES.map((z) => `<section class="sec">
      <div class="sec-h"><h3>${z.name}</h3><span class="muted sm">${z.items.filter((it) => v[phase][it.id]).length}/3</span></div>
      <div class="${phase === 'in' ? 'slots' : 'cmp-list'}">${z.items.map((it) => phase === 'in' ? slotHtml('in', it) : cmpRow(it)).join('')}</div>
    </section>`).join('') + `<p class="fine pad">시각은 데모에서 기기 시각을 사용합니다. 실서비스는 서버 수신 시각 + RFC 3161 TSA 토큰으로 봉인하며, EXIF는 위·변조가 쉬워 증거 근거로 쓰지 않습니다.</p>`;
  }
  function slotHtml(phase, it) {
    const s = state.vault[phase][it.id];
    if (s) return `<div class="slot filled"><img src="${s.img}" alt="${it.name}"><div class="slot-meta"><b>${it.name}</b><small>${fmtDT(s.ts)}</small><code>${shortHash(s.hash)}</code></div><button class="slot-x" data-act="delPhoto" data-phase="${phase}" data-arg="${it.id}" aria-label="삭제">${ic('x', 14)}</button></div>`;
    return `<label class="slot"><input type="file" accept="image/*" capture="environment" data-phase="${phase}" data-slot="${it.id}" hidden>${ic('camera', 26)}<b>${it.name}</b><small>탭하여 촬영</small></label>`;
  }
  function cmpRow(it) {
    const v = state.vault, a = v.in[it.id], j = v.judg[it.id] || 'none';
    return `<div class="cmp">
      <div class="cmp-h"><b>${it.name}</b><select data-input="judg" data-key="${it.id}">
        <option value="none" ${j === 'none' ? 'selected' : ''}>이상 없음</option>
        <option value="wear" ${j === 'wear' ? 'selected' : ''}>자연 마모 (배상 0원)</option>
        <option value="tenant" ${j === 'tenant' ? 'selected' : ''}>임차인 과실</option></select></div>
      <div class="cmp-imgs"><div>${a ? `<img src="${a.img}" alt="입주"><small>입주 ${fmtDate(a.ts)}</small>` : '<div class="noimg">입주 사진 없음</div>'}</div>
        <div>${slotHtml('out', it)}</div></div>
    </div>`;
  }
  function deprecRows() {
    const v = state.vault, yrs = residenceYears();
    return allItems().filter((it) => (v.judg[it.id] || 'none') !== 'none').map((it) => {
      const dp = ZJ.DEPREC[it.cat];
      const cost = v.cost[it.id] != null ? v.cost[it.id] : dp.cost;
      const j = v.judg[it.id];
      const r = E.liability(it.cat, cost, yrs, j);
      return { it, dp, cost, j, ...r };
    });
  }
  function vaultDeprec() {
    const v = state.vault, yrs = residenceYears();
    const rows = deprecRows();
    const total = rows.reduce((s, r) => s + r.pay, 0);
    const unfair = Math.max(0, (+v.claim || 0) - total);
    return `<section class="sec form">
      <div class="sec-h"><h3>거주 기간</h3><span class="muted sm">${yrs.toFixed(1)}년</span></div>
      <div class="grid2"><label>입주일<input type="date" value="${v.moveIn}" data-input="vault" data-key="moveIn"></label><label>퇴거일<input type="date" value="${v.moveOut}" data-input="vault" data-key="moveOut"></label></div>
    </section>
    <section class="sec">
      <div class="sec-h"><h3>항목별 배상 책임 산정</h3></div>
      ${rows.length ? `<div class="dep-list">${rows.map((r) => `<div class="dep ${r.j}">
        <div class="dep-h"><b>${r.it.zone} · ${r.it.name}</b><span class="tag ${r.j === 'wear' ? 'good' : 'bad'}">${r.j === 'wear' ? '자연마모' : '임차인 과실'}</span></div>
        <div class="dep-calc"><label>신규 시공비<input type="number" inputmode="numeric" value="${r.cost}" data-input="cost" data-key="${r.it.id}"></label>
        <div><small>내용연수 ${r.dp.life}년 · 잔존가치</small><b>${r.j === 'wear' ? '해당 없음' : E.pct(r.residual)}</b></div>
        <div><small>임차인 부담</small><b class="${r.pay ? 'c-danger' : 'c-safe'}">${E.fmtWon(r.pay)}</b></div></div></div>`).join('')}</div>`
      : `<div class="empty sm">${ic('camera', 24)}<p>퇴거 비교 탭에서 이상이 있는 항목을 판정하면 여기서 계산돼요.</p><button class="btn ghost sm" data-act="vaultTab" data-arg="out">퇴거 비교로 이동</button></div>`}
      <p class="fine">산식: 부담액 = 신규 시공비 × max(0, 1 − 거주연수 ÷ 내용연수). 통상의 사용에 따른 손모는 임대인 부담(민법 제615조·제654조, 통상손모 법리). 내용연수는 참고값이며 서비스 탑재 전 주택임대차분쟁조정위원회 사례 기준으로 검증이 필요합니다.</p>
    </section>
    <section class="sec">
      <div class="sec-h"><h3>집주인 공제 청구 vs 산정 결과</h3></div>
      <label class="form">집주인이 공제하겠다는 금액 (원)<input type="number" inputmode="numeric" value="${v.claim}" data-input="vault" data-key="claim"></label>
      <div class="vs-box"><div><small>집주인 청구</small><b>${E.fmtWon(+v.claim || 0)}</b></div><div><small>표준 산정 부담액</small><b>${E.fmtWon(total)}</b></div><div class="hl"><small>부당 공제 의심액</small><b>${E.fmtWon(unfair)}</b></div></div>
      <button class="btn primary block" data-act="vaultTab" data-arg="rep">${ic('doc', 18)}퇴거 소명 리포트 만들기</button>
    </section>`;
  }
  function vaultReport() {
    const v = state.vault;
    const inN = Object.keys(v.in).length;
    return `<section class="sec center">
      ${ic('print', 36, 'c-primary')}
      <h3>원상복구 소명 리포트</h3>
      <p class="muted sm">입주·퇴거 사진, 각 사진의 SHA-256 해시와 머클 루트, 감가상각 산정 결과를 한 장의 문서로 정리합니다. 주택임대차분쟁조정위원회 신청이나 내용증명에 첨부할 수 있어요.</p>
      <div class="kv2 sm"><div><small>입주 사진</small><b>${inN}/12</b></div><div><small>판정 항목</small><b>${deprecRows().length}건</b></div></div>
      <button class="btn primary block" data-go="#/report" ${inN ? '' : 'disabled'}>리포트 열기 · PDF 저장</button>
      ${inN ? '' : '<p class="fine">입주 사진을 1장 이상 등록해야 리포트를 만들 수 있어요.</p>'}
      <p class="fine">요금: 9,900원 / 건 (데모에서는 무료)</p>
    </section>`;
  }
  function viewReport() {
    const v = state.vault, rows = deprecRows();
    const total = rows.reduce((s, r) => s + r.pay, 0);
    const ct = state.ct, l = ct ? L(ct.listingId) : null;
    const photos = allItems().filter((it) => v.in[it.id] || v.out[it.id]);
    return `${topbar('퇴거 소명 리포트', { back: true, right: `<button class="icon-btn" data-act="print" aria-label="인쇄">${ic('print', 22)}</button>` })}
    <div class="page report">
      <div class="paper">
        <h2>원상복구 범위 소명서</h2>
        <p class="paper-sub">집지킴 360 사진 금고 · 발급 ${fmtDT(new Date())}</p>
        <table class="ptbl">
          <tr><th>목적물</th><td colspan="3">${l ? esc(l.addr + ' ' + l.name) : '(계약 정보 없음)'}</td></tr>
          <tr><th>임차인</th><td>${ct ? esc(ct.form.tenant) : '-'}</td><th>임대인</th><td>${l ? esc(l.owner) : '-'}</td></tr>
          <tr><th>거주기간</th><td colspan="3">${fmtDate(v.moveIn)} ~ ${fmtDate(v.moveOut)} (${residenceYears().toFixed(1)}년)</td></tr>
          <tr><th>머클 루트</th><td colspan="3"><code id="root-hash">계산 중…</code></td></tr>
        </table>
        <h4>1. 사진 기록 대조</h4>
        <div class="rep-photos">${photos.map((it) => `<div class="rp"><b>${it.zone} · ${it.name}</b><div class="rp-imgs">
          ${['in', 'out'].map((ph) => { const s = v[ph][it.id]; return s ? `<figure><img src="${s.img}" alt=""><figcaption>${ph === 'in' ? '입주' : '퇴거'} ${fmtDT(s.ts)}<br><code>${s.hash}</code></figcaption></figure>` : `<figure class="none">${ph === 'in' ? '입주' : '퇴거'} 사진 없음</figure>`; }).join('')}
          </div><small>판정: ${{ none: '이상 없음', wear: '통상 손모(자연 마모)', tenant: '임차인 과실' }[v.judg[it.id] || 'none']}</small></div>`).join('')}</div>
        <h4>2. 감가상각 산정</h4>
        ${rows.length ? `<table class="ptbl"><tr><th>항목</th><th>판정</th><th>내용연수</th><th>부담액</th></tr>
          ${rows.map((r) => `<tr><td>${r.it.zone} ${r.it.name}</td><td>${r.j === 'wear' ? '자연마모' : '과실'}</td><td>${r.dp.life}년</td><td>${E.fmtWon(r.pay)}</td></tr>`).join('')}
          <tr><th colspan="3">임차인 부담 합계</th><td><b>${E.fmtWon(total)}</b></td></tr>
          <tr><th colspan="3">임대인 공제 청구액</th><td>${E.fmtWon(+v.claim || 0)}</td></tr>
          <tr><th colspan="3">반환 청구 대상 (부당 공제분)</th><td><b>${E.fmtWon(Math.max(0, (+v.claim || 0) - total))}</b></td></tr></table>` : '<p>판정된 손상 항목 없음 — 원상복구 비용 공제 사유 없음.</p>'}
        <h4>3. 소명 요지</h4>
        <p>임차인은 입주 시점의 목적물 상태를 위와 같이 촬영·봉인하였으며, 각 사진의 해시값은 발급 이후 변경되지 않았습니다. 통상의 사용에 따른 손모는 임차인의 원상회복 의무 범위에 포함되지 않으므로, 위 산정액을 초과하는 공제분의 반환을 요청합니다.</p>
        <p class="fine">본 문서는 증빙 정리 도구의 출력물로 법률 자문이 아니며, 법적 효력은 제출 기관의 판단에 따릅니다. 데모 버전은 기기 시각을 사용합니다.</p>
      </div>
    </div>`;
  }

  /* ---------- MY ---------- */
  function viewMy() {
    const v = state.vault, ct = state.ct;
    const fee = E.brokerFee(+state.fee.deposit || 0, +state.fee.rent || 0);
    return `${topbar('MY')}
    <div class="page">
      <section class="profile"><div class="avatar">${ic('user', 26)}</div><div><b>김민수 님</b><small>데모 계정 · 신림동 투룸 전세 탐색 중</small></div></section>
      <section class="sec stats">
        <button data-go="#/contract"><b>${ct ? CT_STEPS[ct.step] : '-'}</b><small>진행 중 계약</small></button>
        <button data-act="goVault"><b>${Object.keys(v.in).length}/12</b><small>사진 금고</small></button>
        <button data-go="#/home"><b>${state.favs.length}</b><small>찜한 매물</small></button>
      </section>
      <section class="sec care">
        <div><b>${ic('bell', 18)}2년 안심케어</b><p>등기부 변동(근저당·압류·소유권 이전) 매일 감시 · 월 1,900원</p></div>
        <button class="toggle ${state.care ? 'on' : ''}" data-act="toggleCare" aria-label="안심케어 구독"><i></i></button>
      </section>
      <section class="sec form">
        <div class="sec-h"><h3>중개보수 계산기</h3><span class="muted sm">2021.10 개정 요율</span></div>
        <div class="grid2"><label>보증금 (만원)<input type="number" inputmode="numeric" value="${state.fee.deposit}" data-input="fee" data-key="deposit"></label><label>월세 (만원)<input type="number" inputmode="numeric" value="${state.fee.rent}" data-input="fee" data-key="rent"></label></div>
        <div id="fee-out">${feeOut(fee)}</div>
      </section>
      <section class="sec">
        <div class="sec-h"><h3>요금 안내</h3></div>
        <div class="price-list">
          <div><span>안심 직거래 전자계약 + 에스크로</span><b>39,000원/건</b></div>
          <div><span>HUG 126% + 등기부 정밀 리포트</span><b>4,900원/건 <em>첫 1회 무료</em></b></div>
          <div><span>원상복구 사진 금고 + 퇴거 리포트</span><b>9,900원/건</b></div>
          <div><span>2년 안심케어 (등기 감시)</span><b>월 1,900원</b></div>
          <div><span>안심 대필 파트너스 (선택)</span><b>50,000원</b></div>
        </div>
      </section>
      <section class="sec">
        <div class="sec-h"><h3>PRD v1.1 반영 사항</h3><span class="muted sm">v1.0 대비 ${ZJ.PRD_CHANGES.length}건</span></div>
        ${ZJ.PRD_CHANGES.map((c) => `<details class="fold prd"><summary><span class="tag ${c.tag === '법률' ? 'bad' : c.tag === '기술' ? 'blue' : ''}">${c.tag}</span>${c.title}</summary><p>${c.body}</p></details>`).join('')}
      </section>
      <section class="sec">
        <button class="row" data-act="resetAll"><div><b>데모 데이터 초기화</b><small>계약·사진·찜·구독 상태를 모두 지웁니다</small></div>${ic('right', 16, 'muted')}</button>
      </section>
      <p class="fine pad center">집지킴 360 프로토타입 · 모든 매물·등기·시세는 가상 데이터입니다.<br>공공 API(건축물대장·공시가격·실거래가)·인터넷등기소·본인인증·은행 에스크로는 목업으로 동작합니다.</p>
    </div>`;
  }
  function feeOut(fee) {
    const save = fee.withVat - 39000;
    return `<div class="fee-out"><div><small>거래금액</small><b>${E.fmtMan(fee.base)}만</b></div><div><small>상한요율</small><b>${(fee.rate * 100).toFixed(1)}%</b></div><div><small>중개보수(VAT)</small><b>${E.fmtWon(fee.withVat)}</b></div></div>
      <p class="save-line">${save > 0 ? `집지킴 이용 시 <b>${E.fmtWon(save)}</b> 절약 (${E.pct(save / fee.withVat)})` : '이 금액대는 중개보수가 이용료보다 낮아요. 안심 진단만 이용해 보세요.'}</p>`;
  }

  function viewNotFound() { return `${topbar('찾을 수 없음', { back: true })}<div class="page"><div class="empty">${ic('search', 28)}<p>페이지를 찾을 수 없어요</p><button class="btn primary sm" data-go="#/home">홈으로</button></div></div>`; }

  function logo() {
    return `<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#2F6BFF"/><path d="M8 15.5 16 9l8 6.5V24H8z" fill="#fff"/><path d="m12.5 18 2.6 2.6 4.6-5" stroke="#2F6BFF" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  /* ---------- 라우터 ---------- */
  const TABS = [
    ['home', '홈', 'home'], ['check', '안심진단', 'shield'], ['contract', '직거래', 'doc'], ['vault', '사진금고', 'camera'], ['my', 'MY', 'user'],
  ];
  function parse() { const h = location.hash.replace(/^#\/?/, '') || 'home'; const [page, arg] = h.split('/'); return { page, arg }; }
  function render(keepScroll) {
    const { page, arg } = parse();
    const view = $('#view');
    const st = view.scrollTop;
    const map = { home: viewHome, listing: viewListing, check: viewCheck, contract: viewContract, vault: viewVault, report: viewReport, my: viewMy };
    view.innerHTML = (map[page] || viewNotFound)(arg);
    view.scrollTop = keepScroll ? st : 0;
    const hideTabs = page === 'listing' || page === 'report';
    $('#app').classList.toggle('no-tabs', hideTabs);
    const activeTab = page === 'listing' ? 'home' : page === 'report' ? 'vault' : page;
    $('#tabbar').innerHTML = TABS.map(([k, t, i]) => `<a href="#/${k}" class="${activeTab === k ? 'on' : ''}">${ic(i, 22)}<span>${t}</span></a>`).join('');
    $('#webnav').innerHTML = `<a class="wn-brand" href="#/home">${logo()}<span>집지킴</span><em>360</em></a>
      <nav>${TABS.map(([k, t]) => `<a href="#/${k}" class="${activeTab === k ? 'on' : ''}">${t === 'MY' ? '마이페이지' : t === '홈' ? '지도 · 매물' : t}</a>`).join('')}</nav>
      <div class="wn-right"><button class="icon-btn" data-act="noti" aria-label="알림">${ic('bell', 20)}${state.care ? '<i class="dot"></i>' : ''}</button><a class="btn primary sm" href="#/contract">직거래 시작</a></div>`;
    document.body.dataset.page = page;
    after(page);
  }
  function after(page) {
    if (page === 'home') { refreshHomeList(); initMap(); }
    if (page === 'contract') initSig();
    if (page === 'report') {
      const hs = allItems().flatMap((it) => ['in', 'out'].map((ph) => state.vault[ph][it.id] && state.vault[ph][it.id].hash).filter(Boolean));
      E.merkleRoot(hs).then((r) => { const el = $('#root-hash'); if (el) el.textContent = r || '-'; });
    }
  }

  /* ---------- 서명 패드 ---------- */
  function initSig() {
    const cv = $('#sig'); if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1B1F24';
    let drawing = false;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height]; };
    cv.addEventListener('pointerdown', (e) => { drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = pt(e); ctx.beginPath(); ctx.moveTo(x, y); cv.dataset.signed = '1'; });
    cv.addEventListener('pointermove', (e) => { if (!drawing) return; const [x, y] = pt(e); ctx.lineTo(x, y); ctx.stroke(); });
    const stop = () => { drawing = false; };
    cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
  }

  /* ---------- 사진 처리 ---------- */
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
  async function processFile(file) {
    const buf = await file.arrayBuffer();
    const hash = await E.sha256(buf);
    const url = URL.createObjectURL(file);
    try {
      const im = await loadImg(url);
      const sc = Math.min(1, 560 / Math.max(im.width, im.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      return { img: cv.toDataURL('image/jpeg', 0.7), hash, ts: new Date().toISOString(), size: file.size };
    } finally { URL.revokeObjectURL(url); }
  }
  async function samplePhoto(it, phase, i) {
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 360;
    const g = cv.getContext('2d');
    const hue = (i * 37 + (phase === 'out' ? 8 : 0)) % 360;
    const grd = g.createLinearGradient(0, 0, 480, 360);
    grd.addColorStop(0, `hsl(${hue},25%,${phase === 'out' ? 78 : 86}%)`); grd.addColorStop(1, `hsl(${hue},20%,${phase === 'out' ? 64 : 72}%)`);
    g.fillStyle = grd; g.fillRect(0, 0, 480, 360);
    g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 250, 480, 110);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; g.strokeRect(150, 60, 180, 140);
    if (phase === 'out' && i % 3 === 0) { g.fillStyle = 'rgba(120,90,40,.28)'; g.beginPath(); g.ellipse(300, 150, 60, 34, 0.4, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(20,30,40,.75)'; g.textAlign = 'center'; g.font = 'bold 26px Pretendard, sans-serif'; g.fillText(`${it.zone} · ${it.name}`, 240, 44);
    g.font = '16px Pretendard, sans-serif'; g.fillText(phase === 'in' ? '입주 기록 (샘플)' : '퇴거 기록 (샘플)', 240, 70);
    const img = cv.toDataURL('image/jpeg', 0.7);
    return { img, hash: await E.sha256(img), ts: new Date(Date.now() - (12 - i) * 1000).toISOString(), size: img.length };
  }
  function saveVault() { if (!store.set('vault', state.vault)) toast('저장 공간이 부족해 이 기기에 저장하지 못했어요', 'warn'); }

  /* ---------- 액션 ---------- */
  const actions = {
    back() { if (history.length > 1) history.back(); else location.hash = '#/home'; },
    closeModal,
    noti() {
      modal(`<h3>알림</h3><div class="rows">
        <div class="row static"><div><b>${state.care ? '등기 감시 정상' : '2년 안심케어를 켜면 등기 변동 알림을 받아요'}</b><small>${state.care ? '오늘 09:00 확인 — 변동 없음' : 'MY 탭에서 구독할 수 있어요'}</small></div></div>
        <div class="row static"><div><b>관심 지역 신규 안심매물</b><small>신림동 투룸 전세 1건 · HUG 가입가능</small></div></div></div>
        <button class="btn primary block" data-act="closeModal">확인</button>`);
    },
    filter(el) { const k = el.dataset.key, v = el.dataset.val; state.filters[k] = state.filters[k] === v && v !== 'all' ? 'all' : v; render(true); },
    safeOnly() { state.filters.safeOnly = !state.filters.safeOnly; render(true); },
    resetFilter() { state.filters = { deal: 'all', room: 'all', safeOnly: false, q: '' }; render(true); },
    pick(el) {
      if (state.mapDragged && Date.now() - state.mapDragged < 250) return;
      const id = el.dataset.arg;
      if (state.selected === id) { location.hash = '#/listing/' + id; return; }
      state.selected = id; refreshHomeList();
      const c = $('#card-' + id); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    fav(el, e) {
      e.stopPropagation();
      const id = el.dataset.arg, i = state.favs.indexOf(id);
      if (i >= 0) state.favs.splice(i, 1); else state.favs.push(id);
      store.set('favs', state.favs); el.classList.toggle('on', i < 0);
      toast(i >= 0 ? '찜을 해제했어요' : '찜한 매물에 담았어요');
    },
    unlock(el) {
      const id = el.dataset.arg;
      const go = () => { state.unlocked.push(id); store.set('unlocked', state.unlocked); closeModal(); render(true); toast('정밀 리포트를 열었어요', 'ok'); };
      if (!state.freeUsed) { state.freeUsed = true; store.set('freeUsed', true); go(); return; }
      modal(`<h3>정밀 권리분석 리포트</h3><div class="bill"><div><span>HUG 126% + 등기부 정밀 리포트</span><b>4,900원</b></div></div>
        <p class="fine">데모 결제입니다. 실제 결제는 발생하지 않습니다.</p><button class="btn primary block" data-act="payUnlock" data-arg="${id}">4,900원 결제 (데모)</button>`);
    },
    payUnlock(el) { state.unlocked.push(el.dataset.arg); store.set('unlocked', state.unlocked); closeModal(); render(true); toast('결제 완료 (데모)', 'ok'); },
    copy(el) { const c = ZJ.CLAUSES.find((x) => x.id === el.dataset.arg); copyText(c.text); },
    copyAll(el) { const l = L(el.dataset.arg); copyText(ZJ.CLAUSES.filter((c) => c.id !== 'c6' || l.type === '다가구').map((c, i) => `${i + 1}. ${c.text}`).join('\n')); },
    copyText(el) { copyText(el.dataset.arg); },
    toggleCare() { state.care = !state.care; store.set('care', state.care); render(true); toast(state.care ? '2년 안심케어 구독 시작 (데모)' : '안심케어 구독을 해지했어요'); },
    startContract(el) {
      const id = el.dataset.arg;
      if (state.ct && state.ct.listingId !== id && state.ct.step > 0) {
        modal(`<h3>진행 중인 계약이 있어요</h3><p class="muted">${esc(L(state.ct.listingId).name)} 계약을 ${CT_STEPS[state.ct.step]} 단계까지 진행했어요. 새 계약을 시작하면 기존 진행 내용이 사라집니다.</p>
          <div class="btn-row wide"><button class="btn line" data-act="goContract">이어서 하기</button><button class="btn primary" data-act="forceContract" data-arg="${id}">새로 시작</button></div>`);
        return;
      }
      if (!state.ct || state.ct.listingId !== id) { state.ct = newContract(L(id)); saveCt(); }
      location.hash = '#/contract/' + id;
    },
    goContract() { closeModal(); location.hash = '#/contract'; },
    forceContract(el) { closeModal(); state.ct = newContract(L(el.dataset.arg)); saveCt(); location.hash = '#/contract/' + el.dataset.arg; },
    resetContract() { const id = state.ct && state.ct.listingId; state.ct = id ? newContract(L(id)) : null; saveCt(); render(); },
    auth(el) {
      const who = el.dataset.arg;
      el.disabled = true; el.innerHTML = '<span class="spin"></span>';
      setTimeout(() => { if (who === 'tenant') state.ct.tenantOk = true; else state.ct.landlordOk = true; saveCt(); render(true); toast(who === 'tenant' ? '본인인증 완료 (데모)' : '임대인이 인증을 완료했어요 (데모)', 'ok'); }, 1100);
    },
    riskAck(el) { state.ct.riskAck = el.checked; saveCt(); render(true); },
    ctNext() {
      const ct = state.ct;
      if (ct.step === 1) {
        const f = ct.form;
        if (!f.tenant.trim() || !(+f.deposit > 0) || !(+f.down > 0) || +f.down > +f.deposit) { toast('계약 조건을 확인해 주세요 (계약금은 보증금 이하)', 'warn'); return; }
      }
      if (ct.step === 4) return;
      ct.step++; saveCt(); render();
    },
    ctPrev() { state.ct.step = Math.max(0, state.ct.step - 1); saveCt(); render(); },
    escrowAll(el) { state.ct.form.escrowAll = el.dataset.arg === '1'; saveCt(); render(true); },
    daepil(el) { state.ct.form.daepil = el.checked; saveCt(); render(true); },
    clause(el) { const ct = state.ct, id = el.dataset.arg; ct.clauses = el.checked ? ct.clauses.concat(id) : ct.clauses.filter((x) => x !== id); saveCt(); render(true); },
    clearSig() { const cv = $('#sig'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); delete cv.dataset.signed; },
    async seal() {
      const cv = $('#sig');
      if (!cv.dataset.signed) { toast('서명을 입력해 주세요', 'warn'); return; }
      if (!$('#agree').checked) { toast('전자서명 효력 동의가 필요해요', 'warn'); return; }
      const ct = state.ct;
      ct.sig = cv.toDataURL('image/png');
      ct.sealedAt = new Date().toISOString();
      ct.hash = await E.sha256(docPayload(ct));
      ct.tsa = 'TST-' + (await E.sha256(ct.hash + ct.sealedAt)).slice(0, 32).toUpperCase();
      saveCt(); render(); toast('계약서가 봉인되었어요', 'ok');
    },
    async verifyHash() {
      const h = await E.sha256(docPayload(state.ct));
      toast(h === state.ct.hash ? '무결성 확인 — 봉인 이후 변경 없음' : '경고: 문서 해시 불일치', h === state.ct.hash ? 'ok' : 'warn');
    },
    escNext() {
      const ct = state.ct, es = ct.escrow, stages = escrowStages(ct);
      if (es.stage >= stages.length - 1) return;
      es.stage++;
      const base = new Date(ct.form.balanceDate + 'T09:00:00');
      const t = new Date(es.stage <= 1 ? Date.now() : base.getTime() + (es.stage - 2) * 6 * 3600000);
      if (es.stage === 1) es.log.push({ t: t.toISOString(), msg: '등기 감시 시작 · 갑구 ' + L(ct.listingId).gap.length + '건 / 을구 ' + L(ct.listingId).eul.length + '건 기준선 저장' });
      for (let k = 0; k < 2; k++) es.log.push({ t: new Date(t.getTime() + k * 3600000).toISOString(), msg: '등기부 변동 없음' });
      if (es.stage === stages.length - 1) es.log.push({ t: new Date(t.getTime() + 3 * 3600000).toISOString(), msg: '대항력 발생 확인 · 정산 지시 완료' });
      saveCt(); render(true);
    },
    escAlert() {
      const es = state.ct.escrow; es.alert = true;
      const last = es.log.length ? new Date(es.log[es.log.length - 1].t).getTime() : Date.now();
      es.alertAt = new Date(last + 30 * 60000).toISOString();
      es.log.push({ t: es.alertAt, msg: '⚠ 을구 근저당권설정 접수 감지 → 알림톡 발송 · 정산 보류', bad: true });
      saveCt(); render(true);
    },
    clearAlert() { const es = state.ct.escrow; es.alert = false; es.log = es.log.filter((g) => !g.bad); saveCt(); render(true); },
    refund() { modal(`<h3>예치금 반환 요청</h3><p class="muted">특약 1(잔금 익일까지 담보권 설정 금지) 위반을 근거로 계약 해제 통지와 에스크로 예치금 전액 반환을 요청합니다. 데모에서는 실제 요청이 발송되지 않습니다.</p><button class="btn primary block" data-act="closeModal">확인</button>`); },
    vaultTab(el) { state.vaultTab = el.dataset.arg; render(); },
    goVault() { state.vaultTab = 'in'; location.hash = '#/vault'; },
    delPhoto(el) { delete state.vault[el.dataset.phase][el.dataset.arg]; saveVault(); render(true); },
    async sampleFill() {
      const items = allItems(), v = state.vault;
      const phase = state.vaultTab === 'out' ? 'out' : 'in';
      for (let i = 0; i < items.length; i++) if (!v[phase][items[i].id]) v[phase][items[i].id] = await samplePhoto(items[i], phase, i);
      if (phase === 'out') { v.judg.living_wall = v.judg.living_wall || 'wear'; v.judg.kitchen_sink = v.judg.kitchen_sink || 'tenant'; v.judg.room_floor = v.judg.room_floor || 'wear'; }
      saveVault(); render(true); toast(phase === 'in' ? '입주 샘플 12장을 봉인했어요' : '퇴거 샘플 12장을 등록했어요', 'ok');
    },
    print() { window.print(); },
    resetAll() {
      modal(`<h3>데모 데이터 초기화</h3><p class="muted">이 기기에 저장된 계약 진행, 사진 금고, 찜, 구독 상태를 모두 삭제합니다.</p><div class="btn-row wide"><button class="btn line" data-act="closeModal">취소</button><button class="btn danger" data-act="doReset">초기화</button></div>`);
    },
    doReset() {
      store.clear();
      Object.assign(state, { favs: [], unlocked: [], freeUsed: false, care: false, ct: null, vault: defaultVault(), vaultTab: 'in', selected: null });
      closeModal(); render(); toast('초기화했어요');
    },
  };
  function docPayload(ct) { return JSON.stringify({ l: ct.listingId, f: ct.form, c: ct.clauses, s: ct.sig, t: ct.sealedAt }); }
  function copyText(t) {
    const ok = () => toast('복사했어요', 'ok');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(ok, () => fallbackCopy(t, ok));
    else fallbackCopy(t, ok);
  }
  function fallbackCopy(t, ok) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); } catch (e) { toast('복사하지 못했어요', 'warn'); }
    ta.remove();
  }

  /* ---------- 입력 바인딩 ---------- */
  const inputs = {
    hugDeposit(el) {
      const id = el.dataset.arg, v = +el.value; state.hugDeposit[id] = v;
      $('#hug-block').innerHTML = hugBlock(L(id), v); $('#dep-val').textContent = E.fmtMan(v);
    },
    manual(el) {
      const k = el.dataset.key; state.manual[k] = k === 'type' ? el.value : +el.value;
      if (k === 'type') render(true); else $('#manual-result').innerHTML = manualResult();
    },
    ctForm(el, ev) {
      const k = el.dataset.key; const f = state.ct.form;
      f[k] = el.type === 'number' || k === 'months' ? +el.value : el.value;
      if (k === 'balanceDate') f.start = el.value;
      if (k === 'deposit' && ev.type === 'change') f.down = Math.round(f.deposit * 0.1);
      saveCt();
      if (ev.type === 'change') render(true);
    },
    judg(el) { state.vault.judg[el.dataset.key] = el.value; saveVault(); },
    cost(el, ev) { state.vault.cost[el.dataset.key] = +el.value; saveVault(); if (ev.type === 'change') render(true); },
    vault(el, ev) { state.vault[el.dataset.key] = el.type === 'number' ? +el.value : el.value; saveVault(); if (ev.type === 'change') render(true); },
    fee(el) { state.fee[el.dataset.key] = +el.value; $('#fee-out').innerHTML = feeOut(E.brokerFee(+state.fee.deposit || 0, +state.fee.rent || 0)); },
  };

  /* ---------- 이벤트 위임 ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a && !(a.tagName === 'INPUT' && (a.type === 'checkbox' || a.type === 'radio'))) {
      if (a.disabled) return;
      const fn = actions[a.dataset.act];
      if (fn) { e.preventDefault(); fn(a, e); }
      return;
    }
    const g = e.target.closest('[data-go]');
    if (g && !g.disabled) { location.hash = g.dataset.go; }
  });
  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.matches('input[type=checkbox][data-act], input[type=radio][data-act]')) { const fn = actions[el.dataset.act]; if (fn) fn(el, e); return; }
    if (el.matches('input[type=file][data-slot]')) {
      const file = el.files && el.files[0]; if (!file) return;
      if (!/^image\//.test(file.type)) { toast('이미지 파일만 등록할 수 있어요', 'warn'); return; }
      try {
        const rec = await processFile(file);
        state.vault[el.dataset.phase][el.dataset.slot] = rec; saveVault(); render(true);
        toast('봉인 완료 · ' + rec.hash.slice(0, 10) + '…', 'ok');
      } catch (err) { toast('사진을 처리하지 못했어요', 'warn'); }
      return;
    }
    if (el.dataset.input && inputs[el.dataset.input]) inputs[el.dataset.input](el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'q') { state.filters.q = el.value; refreshHomeList(); return; }
    if (el.dataset.input && inputs[el.dataset.input] && el.tagName !== 'SELECT') inputs[el.dataset.input](el, e);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  window.addEventListener('hashchange', () => { closeModal(); render(); });
  window.addEventListener('resize', () => { if (parse().page === 'home') initMap(); });
  render();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
