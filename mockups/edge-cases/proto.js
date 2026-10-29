() => {
  const st = document.querySelector('#status.screen.active');
  if (st && !document.querySelector('#statusRows tr:not(.grouphead)') && !document.querySelector('.emptystate')) {
    const tiles = document.getElementById('tiles'); tiles.style.display = 'none';
    st.querySelectorAll('table.grouped, #statusAllBox').forEach((e) => e.style.display = 'none');
    const c = document.createElement('div'); c.className = 'card emptystate';
    c.innerHTML = '<h2>No apps yet</h2><p>Pick a few on Choose stacks: they show up here as they start, with their addresses and what each needs.</p><button class="btn primary">Choose stacks</button>';
    tiles.after(c);
  }
  const ct = document.getElementById('copiesTile');
  if (ct && /0\s*of 0/.test(ct.textContent)) { ct.querySelector('.value').innerHTML = 'None yet'; ct.querySelector('.sub').textContent = 'The first copies are made the night after an app with a database starts'; }
  const rt = document.getElementById('restoreTile');
  if (rt && /Never/.test(rt.textContent)) { rt.querySelector('.sub').firstChild.textContent = 'Tried once there is a backup to test'; }
}
