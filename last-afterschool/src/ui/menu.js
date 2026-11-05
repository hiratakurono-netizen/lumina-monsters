// =====================================================================
//  町のメニュー（HTML の部品をゲーム画面の上に重ねる）
//  リスト・スクロール・詳細表示が多いので、キャンバスより HTML の方が指で扱いやすい
//  使い方：UI.open({ title, tabs: [{ id, label, render(el) }], onClose })
// =====================================================================
const UI = (() => {
  let root = null, cur = null, tab = 0;

  // 小さな要素作成ヘルパー：h('div', { class: 'row', onclick }, [子要素 or 文字])
  function h(tag, attrs = {}, kids = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    (Array.isArray(kids) ? kids : [kids]).forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  }

  function ensureRoot() {
    if (root) return root;
    root = h('div', { id: 'ui', hidden: true });
    document.body.append(root);
    return root;
  }
  function open(def) {
    cur = def; tab = def.startTab || 0; ensureRoot().hidden = false;
    document.body.classList.add('ui-open');
    render();
  }
  function close() {
    if (!cur) return;
    const done = cur.onClose; cur = null;
    root.hidden = true; root.innerHTML = '';
    document.body.classList.remove('ui-open');
    Audio2.sfx('select');
    if (done) done();
  }
  function render() {
    if (!cur) return;
    const old = root.querySelector('.ui-body'), keep = old && root.dataset.tab === String(tab) ? old.scrollTop : 0;   // 同じタブなら位置を保つ
    root.innerHTML = ''; root.dataset.tab = String(tab);
    const tabs = cur.tabs || [];
    const body = h('div', { class: 'ui-body' });
    const panel = h('div', { class: 'ui-panel' + (cur.wide ? ' wide' : ''), role: 'dialog', 'aria-label': cur.title }, [
      h('div', { class: 'ui-head' }, [
        h('div', { class: 'ui-title' }, cur.title),
        cur.headRight ? h('div', { class: 'ui-head-right' }, cur.headRight()) : null,
        h('button', { class: 'ui-close', 'aria-label': '閉じる', onclick: close }, '✕'),
      ]),
      tabs.length > 1 ? h('div', { class: 'ui-tabs', role: 'tablist' }, tabs.map((t, i) =>
        h('button', { class: 'ui-tab' + (i === tab ? ' on' : ''), role: 'tab', 'aria-selected': i === tab ? 'true' : 'false', onclick: () => { tab = i; Audio2.sfx('blip'); render(); } }, t.label))) : null,
      body,
    ]);
    root.append(h('div', { class: 'ui-backdrop', onclick: close }), panel);
    if (tabs[tab]) tabs[tab].render(body);
    body.scrollTop = keep;
  }
  // ちょっとした通知（「保存しました」など）
  function toast(msg) {
    const t = h('div', { class: 'ui-toast', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 1600);
  }
  return { h, open, close, render, toast, get isOpen() { return !!cur; } };
})();
