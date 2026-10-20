import { html, useState } from '../../vendor/preact-htm.js';
import { PLACE_TYPES, addPlace, deletePlace, extractUrl, isMapUrl, mapLinkOf, parseShared, placeTypeOf, safeUrl, updatePlace } from '../places.js';
import { ROLES, partnerOf } from '../roles.js';

const WANTS = (me) => [
  { id: 'both', label: '兩個都想' },
  { id: me, label: '我想去' },
  { id: partnerOf(me), label: `${ROLES[partnerOf(me)].name}想去` },
];
const wantsText = (w) => (w === 'both' ? '💞 兩個都想' : `${ROLES[w]?.name ?? ''}想去`);

/** shared：從 IG／Google 地圖分享進來的文字，有的話直接打開新增表單 */
export function PlacesScreen({ me, places, shared, onSharedUsed }) {
  const [area, setArea] = useState('all');
  const [editing, setEditing] = useState(null);
  const form = editing ?? (shared ? parseShared(shared) : null);
  const close = () => { setEditing(null); onSharedUsed?.(); };

  const [showVisited, setShowVisited] = useState(false);
  const areas = [...new Set(places.map((p) => p.area).filter(Boolean))].sort();
  const inArea = places
    .filter((p) => area === 'all' || p.area === area)
    .sort((a, b) => (b.created_at?.seconds ?? Infinity) - (a.created_at?.seconds ?? Infinity));
  const list = inArea.filter((p) => !p.visited);
  const visited = inArea.filter((p) => p.visited);

  const row = (p) => {
    const t = placeTypeOf(p.type);
    return html`
      <div class="place ${p.visited ? 'visited' : ''}">
        <button class="place-body" onClick=${() => setEditing(p)}>
          <b>${t.icon} ${p.name}${p.visited ? ' ✓' : ''}</b>
          <small>${[p.area && `📍 ${p.area}`, t.label, wantsText(p.wants)].filter(Boolean).join(' · ')}</small>
          ${p.note && html`<small>${p.note}</small>`}
        </button>
        ${mapLinkOf(p) && html`<a class="place-btn map" href=${mapLinkOf(p)} target="_blank" rel="noopener">🗺️<br />導航</a>`}
        ${safeUrl(p.ig_url) && html`<a class="place-btn ig" href=${safeUrl(p.ig_url)} target="_blank" rel="noopener">▶<br />IG</a>`}
      </div>`;
  };

  return html`
    <div class="page">
      <h1>想去的地方</h1>
      ${areas.length > 0 && html`
        <div class="chips wrap">
          <button type="button" class=${area === 'all' ? 'on' : ''} onClick=${() => setArea('all')}>全部（${places.length}）</button>
          ${areas.map((a) => html`<button type="button" class=${area === a ? 'on' : ''} onClick=${() => setArea(a)}>📍 ${a}</button>`)}
        </div>`}

      ${list.length === 0 && html`<p class="hint" style="text-align:center">在 IG 或 Google 地圖看到想去的店，按「分享」→ 選「小寶」，<br />或複製連結後按 ＋ 貼上</p>`}
      ${list.map(row)}

      ${visited.length > 0 && html`
        <button class="link" style="margin-top:8px" onClick=${() => setShowVisited(!showVisited)}>${showVisited ? '▾' : '▸'} 去過的（${visited.length}）</button>
        ${showVisited && visited.map(row)}
      `}

      <button class="fab" onClick=${() => setEditing({})}>＋</button>
      ${form && html`<${PlaceForm} me=${me} place=${form} areas=${areas} onClose=${close} />`}
    </div>
  `;
}

function PlaceForm({ me, place, areas, onClose }) {
  const isNew = !place.id;
  const [f, setF] = useState({
    name: place.name ?? '',
    area: place.area ?? '',
    type: place.type ?? 'food',
    ig_url: place.ig_url ?? '',
    map_url: place.map_url ?? '',
    wants: place.wants ?? 'both',
    note: place.note ?? '',
    visited: place.visited ?? false,
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };

  // 貼上：是地圖連結就放到地圖欄，其他放到 IG 欄
  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      const url = extractUrl(text);
      if (!url) return setError('剪貼簿裡沒有連結，請先在 IG 或 Google 地圖按「複製連結」');
      setError('');
      setF((p) => (isMapUrl(url) ? { ...p, map_url: url } : { ...p, ig_url: url }));
    } catch {
      setError('沒辦法讀剪貼簿，請長按連結欄位貼上');
    }
  }

  function save(e) {
    e.preventDefault();
    if (!f.name.trim()) return setError('請輸入店名');
    const data = { ...f, name: f.name.trim(), area: f.area.trim(), ig_url: extractUrl(f.ig_url), map_url: extractUrl(f.map_url), note: f.note.trim() };
    (isNew ? addPlace(data, me) : updatePlace(place.id, data)).catch(() => {});
    onClose();
  }

  function remove() {
    if (!confirm(`要刪除「${place.name}」嗎？`)) return;
    deletePlace(place.id).catch(() => {});
    onClose();
  }

  return html`
    <div class="sheet-backdrop" onClick=${onClose}>
      <form class="sheet" onClick=${(e) => e.stopPropagation()} onSubmit=${save}>
        <h2>${isNew ? '新增想去的地方' : '編輯'}</h2>
        <label>IG 連結
          <div class="row">
            <input value=${f.ig_url} onInput=${set('ig_url')} placeholder="https://www.instagram.com/reel/..." />
            <button type="button" class="chip-btn" style="flex:none" onClick=${paste}>📋 貼上</button>
          </div>
        </label>
        ${extractUrl(f.ig_url) && html`<a class="link" href=${extractUrl(f.ig_url)} target="_blank" rel="noopener">▶ 打開 IG 看一下店名</a>`}
        <label>Google 地圖連結（可不填，沒填就用店名搜尋）
          <input value=${f.map_url} onInput=${set('map_url')} placeholder="https://maps.app.goo.gl/..." />
        </label>
        <label>店名<input value=${f.name} onInput=${set('name')} placeholder="例如：○○拉麵" /></label>
        <label>地區
          <input value=${f.area} onInput=${set('area')} list="areas" placeholder="例如：高雄左營" />
          <datalist id="areas">${areas.map((a) => html`<option value=${a} />`)}</datalist>
        </label>
        <div>
          <div class="field-label">類型</div>
          <div class="segmented">
            ${PLACE_TYPES.map((t) => html`<button type="button" class=${f.type === t.id ? 'on' : ''} onClick=${() => setF((p) => ({ ...p, type: t.id }))}>${t.icon} ${t.label}</button>`)}
          </div>
        </div>
        <div>
          <div class="field-label">誰想去</div>
          <div class="segmented">
            ${WANTS(me).map((w) => html`<button type="button" class=${f.wants === w.id ? 'on' : ''} onClick=${() => setF((p) => ({ ...p, wants: w.id }))}>${w.label}</button>`)}
          </div>
        </div>
        <label>備註<input value=${f.note} onInput=${set('note')} placeholder="例如：要預約、週一公休" /></label>
        ${!isNew && html`
          <label class="check"><input type="checkbox" checked=${f.visited} onChange=${(e) => { const v = e.target.checked; setF((p) => ({ ...p, visited: v })); }} /> ✓ 已經去過了（會收到「去過的」裡）</label>`}
        ${error && html`<p class="error">${error}</p>`}
        <div class="sheet-actions">
          ${!isNew && html`<button type="button" class="btn ghost danger" onClick=${remove}>刪除</button>`}
          <button type="button" class="btn ghost" onClick=${onClose}>取消</button>
          <button class="btn">儲存</button>
        </div>
      </form>
    </div>
  `;
}
