/* Turns the US mapping agency's worldwide navigational warnings into compact GeoJSON the map can
   read directly. Two reasons this has to be a proxy: the source sends no cross-origin header, and
   its positions are buried in the message text rather than published as geometry.

   No credential is involved. The upstream is public domain, and the edge cache means one upstream
   call serves every viewer for half an hour. */
const SRC = 'https://msi.nga.mil/api/publications/broadcast-warn?output=json&status=A';
const ALLOW = 'https://acwave25.github.io';
const MAX_PER_MSG = 40;   // rig-position lists can carry sixty coordinates; that is a table, not a chart

/* 19-23.0N 092-03.1W  and  1923.0N 09203.1W, the two layouts the messages actually use */
const POS = /(\d{1,2})[-\s]?(\d{2}(?:\.\d+)?)\s*([NS])[,\s]+(\d{1,3})[-\s]?(\d{2}(?:\.\d+)?)\s*([EW])/g;

function positions(text) {
  const out = [];
  let m;
  POS.lastIndex = 0;
  while ((m = POS.exec(text)) && out.length < MAX_PER_MSG) {
    const lat = (+m[1] + +m[2] / 60) * (m[3] === 'S' ? -1 : 1);
    const lon = (+m[4] + +m[5] / 60) * (m[6] === 'W' ? -1 : 1);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) out.push([lon, lat]);
  }
  return out;
}

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
    try {
      const r = await fetch(SRC, {
        headers: { 'user-agent': 'WaveAdvisors-DepthMap/1.0 (+https://acwave25.github.io/depth/)',
                   'accept': 'application/json' },
        cf: { cacheTtl: 1800, cacheEverything: true }
      });
      if (!r.ok) return new Response('upstream ' + r.status, { status: 502, headers: cors() });
      const list = (await r.json())['broadcast-warn'] || [];
      // one feature per message, its positions as a MultiPoint: repeating the message text under
      // every rig position tripled the payload for no extra information
      const features = [];
      for (const w of list) {
        const text = w.text || '';
        const pts = positions(text);
        if (!pts.length) continue;
        features.push({
          type: 'Feature',
          geometry: { type: 'MultiPoint', coordinates: pts },
          properties: {
            id: w.navArea + '/' + w.msgNumber + '/' + w.msgYear,
            area: w.navArea,
            issued: w.issueDate,
            text: text.length > 700 ? text.slice(0, 700) + '…' : text
          }
        });
      }
      return new Response(JSON.stringify({ type: 'FeatureCollection', count: list.length, features }), {
        headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'public, max-age=1800' }, cors())
      });
    } catch (e) {
      return new Response('proxy error', { status: 502, headers: cors() });
    }
  }
};

const cors = () => ({
  'access-control-allow-origin': ALLOW,
  'access-control-allow-methods': 'GET, OPTIONS'
});
