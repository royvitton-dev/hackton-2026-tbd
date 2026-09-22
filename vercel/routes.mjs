import { APPS } from '../park/server/routes.mjs';

export function deploymentRoutes(indexes = []) {
  const ids = APPS.map(app => app.id).join('|');
  return [
    { src: '^/$', status: 307, headers: { Location: '/park/' } },
    { src: '^/vehicle(?:/(.*))?$', status: 307, headers: { Location: '/battery_health/$1' } },
    { src: `^/(${ids})$`, status: 308, headers: { Location: '/$1/' } },
    { src: `^/apps/(${ids})/(.*)$`, status: 307, headers: { Location: '/$1/$2' } },
    { src: '^/api/project-asset/(movie|pinball)/(.*)$', dest: '/$1/$2' },
    { src: '^/(?:battery_health/)?api/users$', dest: '/battery_health/data/users.json' },
    { src: '^/(?:battery_health/)?api/users/(U[0-9]+)/sessions$', dest: '/battery_health/data/sessions/$1.json' },
    { src: '^/(?:battery_health/)?api/users/(U[0-9]+)$', dest: '/battery_health/data/users/$1.json' },
    { src: '^/(api/(?:park|refresh|launch|apps)|map/api/infrastructure/.*|trading/backend/.*)$', dest: '/api/park-router?__park_path=/$1' },
    { src: '^/(.*\\.(?:mp4|webm|glb|woff2))$', headers: { 'Cache-Control': 'public, max-age=86400' }, continue: true },
    { handle: 'filesystem' },
    ...indexes.map(file => ({ src: `^${file.slice(0, -10).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}?$`, dest: file })),
    ...APPS.filter(app => app.kind === 'vite').map(app => ({ src: `^/${app.id}/(?:[^.]+)?$`, dest: `/${app.id}/index.html` })),
    { src: '^/.*$', status: 404, dest: '/404.html' },
  ];
}
