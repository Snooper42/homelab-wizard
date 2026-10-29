() => {
  const nav = document.getElementById('settingsNav');
  const sel = document.createElement('label');
  sel.className = 'pagepick';
  const groups = []; let cur = null;
  for (const e of nav.querySelectorAll('.navhead, .pagebtn, .navfold')) {
    if (e.classList.contains('navhead')) { cur = { label: e.textContent.trim(), items: [] }; groups.push(cur); continue; }
    if (!cur) { cur = { label: '', items: [] }; groups.push(cur); }
    cur.items.push({ t: e.textContent.trim().replace(/\d+$/, '').trim(), on: e.classList.contains('active') || e.getAttribute('aria-current') });
  }
  sel.innerHTML = `<span>Page</span><select>${groups.map((g) => `<optgroup label="${g.label}">${g.items.map((i) => `<option${i.on ? ' selected' : ''}>${i.t}</option>`).join('')}</optgroup>`).join('')}</select>`;
  nav.style.display = 'none';
  nav.after(sel);
  const st = document.createElement('style');
  st.textContent = '.pagepick{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-weight:600;color:var(--muted);font-size:13px}.pagepick select{flex:1;min-width:0;font:inherit;font-size:14px;color:var(--text);padding:6px 10px;border-radius:8px;border:1px solid var(--line-strong);background:var(--panel)}';
  document.head.append(st);
}
