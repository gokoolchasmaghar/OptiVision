import api from '../services/api';

export const assetUrl = url => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;

  const base = api.defaults.baseURL || '';
  if (!base || base === '/api') return url;

  const origin = base.endsWith('/api') ? base.slice(0, -4) : base;
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
};
