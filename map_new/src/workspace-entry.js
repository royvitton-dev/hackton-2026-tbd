// A separate entry keeps the address study independent of the parking editor.
if (['google','markers'].includes(new URLSearchParams(location.search).get('view'))) {
  await import('./address/google-app.js');
} else if (new URLSearchParams(location.search).get('view') === 'address') {
  await import('./address/app.js');
} else {
  await import('./main.js');
  const nav = document.querySelector('.topbar nav');
  if (nav && !document.querySelector('.address-entry')) {
    const link = document.createElement('a');
    link.className = 'address-entry'; link.textContent = '주소로 3D ↗';
    link.href = import.meta.env.BASE_URL + '?view=address';
    link.addEventListener('click', () => {
      const id = window.__parking?.state.selected?.id;
      if (id) link.href = import.meta.env.BASE_URL + '?view=address&site=' + encodeURIComponent(id);
    });
    nav.append(link);
    const style = document.createElement('style');
    style.textContent = '.topbar nav .address-entry{display:flex;align-items:center;white-space:nowrap;text-decoration:none;font-size:12px;color:#527d62;padding:0 10px;border-bottom:3px solid transparent}.topbar nav .address-entry:hover{border-bottom-color:#679578}@media(max-width:700px){.topbar nav .address-entry{font-size:11px;padding:0 7px}}';
    document.head.append(style);
  }
}
