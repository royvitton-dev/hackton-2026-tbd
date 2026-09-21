// Vite supplies '/' for standalone development and '/map/' in the shared router.
export const base = import.meta.env.BASE_URL;
export const assetPath = value => typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')?base+value.slice(1):value;
