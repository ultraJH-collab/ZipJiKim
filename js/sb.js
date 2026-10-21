/* 집지킴 360 — Supabase 연동 (로그인 · 매물 DB · 클라우드 동기화 · 사진 원본 보관 · 서버 봉인 시각)
   supabase-js(CDN)가 없거나 서버에 닿지 않으면 ZJ.sb.enabled = false 로 기존 로컬 데모 그대로 동작한다. */
(function () {
  const SB_URL = 'https://mgeiqrxzuueygnemnwkq.supabase.co';
  const SB_KEY = 'sb_publishable_4Y41_pPz3rX1MVjiTy9Eww_j3cmTqRb'; // 공개용 키 (RLS로 보호)
  const BUCKET = 'vault-photos';
  const CID = Math.random().toString(36).slice(2); // 이 탭에서 보낸 변경의 실시간 에코 무시용

  const sb = (ZJ.sb = { enabled: false, user: null, status: 'off', error: '' });
  const A = ZJ.app;
  if (!A || !window.supabase || !window.supabase.createClient) return;

  const db = window.supabase.createClient(SB_URL, SB_KEY, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } });
  sb.enabled = true;
  sb.client = db;

  const S = A.state;
  const uid = () => sb.user && sb.user.id;
  const redirect = () => location.origin + location.pathname;
  const files = {};        // 'in/slot' → 사용자가 고른 원본 File (업로드 대기)
  let favSet = new Set();  // 서버에 있는 찜
  let photoSet = {};       // 'in/slot' → 서버에 기록된 해시
  let channel = null;
  let pulling = false;

  function setStatus(s, err) {
    sb.status = s; sb.error = err || '';
    if (A.parse().page === 'my') A.render(true);
  }
  function fail(e) { console.warn('[zj/sb]', e); setStatus('error', (e && e.message) || String(e)); }
  const must = (r) => { if (r.error) throw r.error; return r.data; };

  /* ---------- 매물: DB → ZJ.LISTINGS (같은 형태로 변환) ---------- */
  const CORE = { id: 'id', name: 'name', addr: 'addr', dong: 'dong', type: 'type', deal: 'deal', deposit: 'deposit', rent: 'rent', rooms: 'rooms', landlord_verified: 'landlordVerified' };
  function toListing(r) { const l = Object.assign({}, r.detail); for (const k in CORE) l[CORE[k]] = r[k]; return l; }
  async function loadListings() {
    const rows = must(await db.from('listings').select('*').order('sort'));
    if (!rows.length) return;
    const next = rows.map(toListing);
    if (JSON.stringify(next) === JSON.stringify(ZJ.LISTINGS)) return;
    ZJ.LISTINGS.splice(0, ZJ.LISTINGS.length, ...next);
    A.resetMemo(); A.render(true);
  }

  /* ---------- 로컬 → 서버 (store.set 훅, 키별 디바운스) ---------- */
  const timers = {};
  sb.push = function (k, v) {
    if (!uid() || pulling) return;
    const key = { unlocked: 'user', freeUsed: 'user', care: 'user' }[k] || k;
    if (!pushers[key]) return;
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => run(key, v), 400);
  };
  async function run(key, v) {
    setStatus('syncing');
    try { await pushers[key](v); setStatus('ok'); } catch (e) { fail(e); }
  }
  const pushers = {
    async favs(list) {
      const want = new Set(list), add = list.filter((id) => !favSet.has(id)), del = [...favSet].filter((id) => !want.has(id));
      if (add.length) must(await db.from('favorites').upsert(add.map((listing_id) => ({ user_id: uid(), listing_id }))));
      if (del.length) must(await db.from('favorites').delete().eq('user_id', uid()).in('listing_id', del));
      favSet = want;
    },
    async user() {
      must(await db.from('user_state').upsert({ user_id: uid(), unlocked: S.unlocked, free_used: S.freeUsed, care: S.care }));
    },
    async ct(ct) {
      if (!ct) { must(await db.from('contracts').delete().eq('user_id', uid())); return; }
      must(await db.from('contracts').upsert({ user_id: uid(), listing_id: ct.listingId, step: ct.step, data: Object.assign({}, ct, { _cid: CID }) }, { onConflict: 'user_id' }));
    },
    async vault(v) {
      const meta = { moveIn: v.moveIn, moveOut: v.moveOut, claim: v.claim, judg: v.judg, cost: v.cost, _cid: CID };
      must(await db.from('vaults').upsert({ user_id: uid(), meta }));
      // 삭제된 사진
      for (const key of Object.keys(photoSet)) {
        const [ph, slot] = key.split('/');
        if (v[ph][slot]) continue;
        delete photoSet[key];
        must(await db.from('vault_photos').delete().match({ user_id: uid(), phase: ph, slot }));
        await db.storage.from(BUCKET).remove([`${uid()}/${ph}/${slot}`]);
      }
      // 새로 찍은 사진 (원본 File이 있으면 원본, 없으면 저장된 축소본 업로드)
      let changed = false;
      for (const ph of ['in', 'out']) {
        for (const slot of Object.keys(v[ph])) {
          const rec = v[ph][slot], key = ph + '/' + slot;
          if (photoSet[key] === rec.hash) continue;
          const body = files[key] || (await (await fetch(rec.img)).blob());
          const path = `${uid()}/${ph}/${slot}`;
          must(await db.storage.from(BUCKET).upload(path, body, { upsert: true, contentType: body.type || 'image/jpeg' }));
          photoSet[key] = rec.hash;
          const row = must(await db.from('vault_photos').upsert({ user_id: uid(), phase: ph, slot, storage_path: path, client_sha256: rec.hash, size: rec.size || body.size, taken_at: rec.ts }).select('server_received_at').single());
          rec.srv = row.server_received_at; rec.remote = path; delete files[key];
          changed = true;
        }
      }
      if (changed) { A.store.put('vault', S.vault); if (A.parse().page === 'vault') A.render(true); }
    },
  };
  sb.attach = function (phase, slot, file) { files[phase + '/' + slot] = file; };

  /* ---------- 서버 → 로컬 (로그인 직후 · 다른 기기 변경 시) ---------- */
  async function pull() {
    if (!uid()) return;
    pulling = true; setStatus('syncing');
    try {
      const u = uid();
      const [fav, us, ct, vt, ph] = await Promise.all([
        db.from('favorites').select('listing_id').eq('user_id', u),
        db.from('user_state').select('*').eq('user_id', u).maybeSingle(),
        db.from('contracts').select('*').eq('user_id', u).maybeSingle(),
        db.from('vaults').select('*').eq('user_id', u).maybeSingle(),
        db.from('vault_photos').select('*').eq('user_id', u),
      ].map((p) => p.then(must)));
      const up = []; // 서버에 없던 로컬 데이터 → 업로드 (첫 로그인 이관)

      favSet = new Set(fav.map((r) => r.listing_id));
      const favs = [...new Set([...favSet, ...S.favs])];
      if (favs.length !== favSet.size) up.push(['favs', favs]);
      S.favs = favs; A.store.put('favs', favs);

      if (us) {
        S.unlocked = [...new Set([...us.unlocked, ...S.unlocked])]; S.freeUsed = us.free_used || S.freeUsed; S.care = us.care;
        if (S.unlocked.length !== us.unlocked.length || S.freeUsed !== us.free_used) up.push(['user']);
      } else if (S.unlocked.length || S.freeUsed || S.care) up.push(['user']);
      A.store.put('unlocked', S.unlocked); A.store.put('freeUsed', S.freeUsed); A.store.put('care', S.care);

      if (ct) { const d = Object.assign({}, ct.data); delete d._cid; S.ct = d; A.store.put('ct', d); } else if (S.ct) up.push(['ct', S.ct]);

      const v = S.vault;
      if (vt) { const m = Object.assign({}, vt.meta); delete m._cid; Object.assign(v, m); }
      photoSet = {};
      // 한 번 서버에 올라갔던(remote) 사진이 서버에서 사라졌으면 다른 기기에서 삭제한 것
      ['in', 'out'].forEach((p) => Object.keys(v[p]).forEach((s) => { if (v[p][s].remote && !ph.some((r) => r.phase === p && r.slot === s)) delete v[p][s]; }));
      const need = ph.filter((r) => r.storage_path);
      const signed = need.length ? must(await db.storage.from(BUCKET).createSignedUrls(need.map((r) => r.storage_path), 3600)) : [];
      need.forEach((r, i) => {
        photoSet[r.phase + '/' + r.slot] = r.client_sha256;
        const local = v[r.phase][r.slot];
        if (local && local.hash === r.client_sha256 && !/^https?:/.test(local.img)) { local.srv = r.server_received_at; local.remote = r.storage_path; return; }
        if (signed[i] && signed[i].signedUrl) v[r.phase][r.slot] = { img: signed[i].signedUrl, hash: r.client_sha256, ts: r.taken_at, srv: r.server_received_at, size: r.size, remote: r.storage_path };
      });
      const localOnly = ['in', 'out'].some((p) => Object.keys(v[p]).some((s) => !photoSet[p + '/' + s]));
      if (!vt || localOnly) up.push(['vault', v]);
      A.store.put('vault', v);

      pulling = false;
      for (const [k, val] of up) await pushers[k](val);
      setStatus('ok');
      A.render(true);
    } catch (e) { pulling = false; fail(e); }
  }

  /* ---------- 실시간: 같은 계정의 다른 기기에서 바뀐 계약·금고 ---------- */
  let pullTimer;
  const later = () => { clearTimeout(pullTimer); pullTimer = setTimeout(pull, 600); };
  function subscribe() {
    unsubscribe();
    const f = `user_id=eq.${uid()}`;
    const mine = (p) => (p.new && ((p.new.data && p.new.data._cid === CID) || (p.new.meta && p.new.meta._cid === CID)));
    channel = db.channel('zj-' + uid())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts', filter: f }, (p) => { if (!mine(p)) later(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vaults', filter: f }, (p) => { if (!mine(p)) later(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vault_photos', filter: f }, (p) => {
        const r = p.new && p.new.slot ? p.new : null;
        if (r && photoSet[r.phase + '/' + r.slot] === r.client_sha256) return;
        if (p.eventType === 'DELETE') return; // 삭제는 금고 메타 갱신으로 함께 반영
        later();
      })
      .subscribe();
  }
  function unsubscribe() { if (channel) { db.removeChannel(channel); channel = null; } }

  /* ---------- 서버 봉인 시각 (append-only seals 테이블) ---------- */
  sb.seal = async function (kind, ref, sha256) {
    if (!uid()) return null;
    try { return must(await db.from('seals').insert({ kind, ref, sha256 }).select('id, server_time').single()); } catch (e) { fail(e); return null; }
  };

  /* ---------- 클라우드 데이터 삭제 (데모 초기화) — 봉인 기록은 삭제 불가 ---------- */
  sb.wipe = async function () {
    if (!uid()) return;
    const u = uid();
    try {
      const paths = Object.keys(photoSet).map((k) => `${u}/${k}`);
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
      await Promise.all(['favorites', 'user_state', 'contracts', 'vaults', 'vault_photos'].map((t) => db.from(t).delete().eq('user_id', u).then(must)));
      favSet = new Set(); photoSet = {};
      setStatus('ok');
    } catch (e) { fail(e); }
  };

  /* ---------- 인증 ---------- */
  db.auth.onAuthStateChange((event, session) => {
    const next = session ? session.user : null;
    const changed = (next && next.id) !== uid();
    sb.user = next;
    if (!changed) return;
    // 콜백 안에서 다른 supabase 호출을 기다리면 교착될 수 있어 다음 틱으로 미룸
    setTimeout(() => {
      if (next) { subscribe(); pull(); } else { unsubscribe(); favSet = new Set(); photoSet = {}; setStatus('off'); }
    }, 0);
  });

  const emailOf = () => (document.getElementById('sb-email') || {}).value || '';
  const pwOf = () => (document.getElementById('sb-pw') || {}).value || '';
  function busy(el, on) { if (el) { el.disabled = on; el.classList.toggle('loading', on); } }
  const ERR = { 'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않아요', 'Email not confirmed': '메일함의 인증 링크를 먼저 눌러 주세요', 'User already registered': '이미 가입된 이메일이에요. 로그인해 주세요' };
  const msg = (e) => ERR[e.message] || e.message;

  Object.assign(A.actions, {
    login() {
      A.modal(`<h3>로그인 · 회원가입</h3>
        <p class="muted sm">로그인하면 찜·계약 진행·사진 금고가 클라우드에 저장되고 다른 기기에서도 이어서 쓸 수 있어요.</p>
        <div class="form"><label>이메일<input id="sb-email" type="email" autocomplete="email" inputmode="email"></label>
        <label>비밀번호 (6자 이상)<input id="sb-pw" type="password" autocomplete="current-password"></label></div>
        <div class="btn-row wide"><button class="btn line" data-act="sbSignup">회원가입</button><button class="btn primary" data-act="sbLogin">로그인</button></div>
        <button class="link sm" data-act="sbMagic">비밀번호 없이 로그인 링크 받기</button>`);
      setTimeout(() => { const el = document.getElementById('sb-email'); if (el) el.focus(); }, 50);
    },
    async sbLogin(el) {
      busy(el, true);
      const { error } = await db.auth.signInWithPassword({ email: emailOf().trim(), password: pwOf() });
      busy(el, false);
      if (error) { A.toast(msg(error), 'warn'); return; }
      A.closeModal(); A.toast('로그인했어요 · 클라우드 동기화 중', 'ok');
    },
    async sbSignup(el) {
      if (pwOf().length < 6) { A.toast('비밀번호는 6자 이상이어야 해요', 'warn'); return; }
      busy(el, true);
      const { data, error } = await db.auth.signUp({ email: emailOf().trim(), password: pwOf(), options: { emailRedirectTo: redirect() } });
      busy(el, false);
      if (error) { A.toast(msg(error), 'warn'); return; }
      A.closeModal();
      A.toast(data.session ? '가입 완료 · 로그인했어요' : '인증 메일을 보냈어요. 링크를 누르면 가입이 완료돼요', 'ok');
    },
    async sbMagic(el) {
      const email = emailOf().trim();
      if (!email) { A.toast('이메일을 입력해 주세요', 'warn'); return; }
      busy(el, true);
      const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
      busy(el, false);
      if (error) { A.toast(msg(error), 'warn'); return; }
      A.closeModal(); A.toast('로그인 링크를 메일로 보냈어요', 'ok');
    },
    async logout() {
      await db.auth.signOut();
      A.render(true); A.toast('로그아웃했어요 · 이 기기의 데이터는 그대로 남아 있어요');
    },
    sbRetry() { pull(); },
  });

  loadListings().catch((e) => console.warn('[zj/sb] 매물 DB 연결 실패 — 로컬 데모 데이터 사용', e));
})();
