const API_KEY        = 'AIzaSyD-NoHOpGpVBS3w8U7qwuyHpONkgNz_z2U';
const CHANNEL_HANDLE = 'Coolcanada-rt3547';

const FAVOURITE_HANDLES = [
  'JJstrangechannel',
  'Dustin-t6m',
  'CoolasakiFranceball',
  'Aspirerb',
  'CanadaQuebec_cb'
];

const SUB_GOAL  = 1000;
const LIKE_GOAL = 10000;

let channelId  = null;
let uploadsId  = null;
let totalSubs  = 0;

// ---- ENTRY POINT ----
async function loadData() {
  try {
    if (!channelId) await resolveChannel();
    await Promise.all([loadChannelStats(), loadVideos(), loadFavouriteCreators(), loadRobloxProfile()]);
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

// ---- RESOLVE CHANNEL ID FROM HANDLE ----
async function resolveChannel() {
  const url  = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&forHandle=${CHANNEL_HANDLE}&key=${API_KEY}`;
  const data = await apiFetch(url);
  const ch   = data.items[0];

  channelId = ch.id;
  uploadsId = ch.contentDetails.relatedPlaylists.uploads;

  const name = ch.snippet.title;
  document.getElementById('channel-name').textContent = name;
  document.getElementById('channel-avatar').src = ch.snippet.thumbnails.medium?.url || ch.snippet.thumbnails.default.url;
  document.getElementById('footer-name').textContent  = name;
  document.title = name;
}

// ---- CHANNEL STATS ----
async function loadChannelStats() {
  const url  = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${API_KEY}`;
  const data = await apiFetch(url);
  const s    = data.items[0].statistics;

  totalSubs = parseInt(s.subscriberCount || 0);
  const views = parseInt(s.viewCount     || 0);
  const vids  = parseInt(s.videoCount    || 0);

  document.getElementById('sub-count').textContent   = fmt(totalSubs);
  document.getElementById('view-count').textContent  = fmt(views);
  document.getElementById('video-count').textContent = fmt(vids);

  setProgress('sub-bar', 'sub-pct', totalSubs, SUB_GOAL);
}

// ---- VIDEOS + LIKE TOTAL ----
async function loadVideos() {
  // Paginate uploads playlist to get all videos (up to 200)
  let allItems  = [];
  let pageToken = '';
  do {
    const url  = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50${pageToken ? '&pageToken=' + pageToken : ''}&key=${API_KEY}`;
    const data = await apiFetch(url);
    allItems   = allItems.concat(data.items);
    pageToken  = data.nextPageToken || '';
  } while (pageToken && allItems.length < 200);

  // videos.list only accepts 50 IDs at a time — batch if needed
  let allVideos = [];
  for (let i = 0; i < allItems.length; i += 50) {
    const ids      = allItems.slice(i, i + 50).map(x => x.snippet.resourceId.videoId).join(',');
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${ids}&key=${API_KEY}`;
    const data     = await apiFetch(statsUrl);
    allVideos      = allVideos.concat(data.items);
  }

  const statsData = { items: allVideos };


  const totalLikes = statsData.items.reduce((sum, v) => sum + parseInt(v.statistics.likeCount || 0), 0);
  document.getElementById('like-count').textContent = totalLikes.toLocaleString();
  setProgress('like-bar', 'like-pct', totalLikes, LIKE_GOAL);

  const allShorts = statsData.items.filter(v => isShort(v));
  const latest    = allShorts.slice(0, 10);
  const top6      = [...allShorts]
    .sort((a, b) => parseInt(b.statistics.viewCount || 0) - parseInt(a.statistics.viewCount || 0))
    .slice(0, 5);

  renderShorts(latest);
  renderTopShorts(top6);

  if (totalSubs >= SUB_GOAL || totalLikes >= LIKE_GOAL) launchConfetti();
}

// YouTube Shorts can be up to 3 minutes
function isShort(video) {
  const dur = video.contentDetails?.duration || '';
  return parseDuration(dur) <= 180;
}

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

// ---- RENDER SHORTS ----
function renderShorts(shorts) {
  const section = document.getElementById('shorts-section');
  const grid    = document.getElementById('shorts-grid');

  if (!shorts.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  grid.innerHTML = '';

  shorts.forEach(v => {
    const s    = v.statistics;
    const sn   = v.snippet;
    const thumb = sn.thumbnails.high?.url || sn.thumbnails.medium?.url || sn.thumbnails.default?.url;
    const link  = `https://www.youtube.com/shorts/${v.id}`;

    const card = document.createElement('a');
    card.className = 'short-card';
    card.href = link;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = `
      <div class="short-thumb-wrap">
        <img class="short-thumb" src="${thumb}" alt="${escHtml(sn.title)}" loading="lazy"/>
        <span class="shorts-badge">⚡ SHORT</span>
      </div>
      <div class="video-info">
        <div class="video-title">${escHtml(sn.title)}</div>
        <div class="video-meta">
          <span>👁️ ${fmt(s.viewCount || 0)}</span>
          <span>❤️ ${fmt(s.likeCount || 0)}</span>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ---- RENDER TOP 6 SHORTS ----
function renderTopShorts(videos) {
  const section = document.getElementById('videos-section');
  const grid    = document.getElementById('videos-grid');

  if (!videos.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  grid.innerHTML = '';

  videos.forEach(v => {
    const s    = v.statistics;
    const sn   = v.snippet;
    const thumb = sn.thumbnails.high?.url || sn.thumbnails.medium?.url || sn.thumbnails.default?.url;
    const link  = `https://www.youtube.com/shorts/${v.id}`;

    const card = document.createElement('a');
    card.className = 'short-card';
    card.href = link;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = `
      <div class="short-thumb-wrap">
        <img class="short-thumb" src="${thumb}" alt="${escHtml(sn.title)}" loading="lazy"/>
        <span class="shorts-badge">⚡ SHORT</span>
      </div>
      <div class="video-info">
        <div class="video-title">${escHtml(sn.title)}</div>
        <div class="video-meta">
          <span>👁️ ${fmt(s.viewCount || 0)}</span>
          <span>❤️ ${fmt(s.likeCount || 0)}</span>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ---- ROBLOX PROFILE ----
const ROBLOX_USER_ID = '7378148606';

async function loadRobloxProfile() {
  document.getElementById('roblox-chip').href = `https://www.roblox.com/users/${ROBLOX_USER_ID}/profile`;

  try {
    const res    = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${ROBLOX_USER_ID}&size=420x420&format=Png&isCircular=false`);
    if (!res.ok) return;
    const data   = await res.json();
    const imgUrl = data.data?.[0]?.imageUrl;
    if (!imgUrl) return;

    const avatar = document.getElementById('roblox-avatar');
    const icon   = document.getElementById('roblox-icon');
    avatar.src           = imgUrl;
    avatar.style.display = 'block';
    icon.style.display   = 'none';
  } catch (e) {
    // CORS blocked — static fallback already in place
  }
}

// ---- FAVOURITE CREATORS ----
async function loadFavouriteCreators() {
  const results = await Promise.all(
    FAVOURITE_HANDLES.map(handle =>
      apiFetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${handle}&key=${API_KEY}`)
        .catch(() => null)
    )
  );

  const creators = results
    .filter(r => r?.items?.length)
    .map(r => r.items[0]);

  const grid = document.getElementById('creators-grid');
  grid.innerHTML = '';

  creators.forEach(ch => {
    const handle = ch.snippet.customUrl || '';
    const url    = `https://www.youtube.com/${handle}`;
    const subs   = parseInt(ch.statistics.subscriberCount || 0);
    const avatar = ch.snippet.thumbnails.medium?.url || ch.snippet.thumbnails.default?.url;

    const card = document.createElement('a');
    card.className = 'creator-card';
    card.href      = url;
    card.target    = '_blank';
    card.rel       = 'noopener noreferrer';
    card.innerHTML = `
      <img class="creator-avatar" src="${avatar}" alt="${escHtml(ch.snippet.title)}"/>
      <div class="creator-name">${escHtml(ch.snippet.title)}</div>
      <div class="creator-subs">👥 ${fmt(subs)} subscribers</div>
      <div class="creator-btn">Visit Channel</div>`;
    grid.appendChild(card);
  });
}

// ---- HELPERS ----
function setProgress(barId, pctId, value, goal) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  document.getElementById(barId).style.width = pct + '%';
  document.getElementById(pctId).textContent = pct + '% of the way there!';
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function fmt(n) {
  n = parseInt(n);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ---- CONFETTI ----
function launchConfetti() {
  const colors = ['#FF4B4B','#FFD93D','#6BCB77','#4D96FF','#9B5DE5','#FF9F1C'];
  const container = document.getElementById('confetti-container');
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${Math.random()*100}%;
      background: ${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration: ${1.5 + Math.random()*2}s;
      animation-delay: ${Math.random()*1.5}s;
      width: ${8 + Math.random()*10}px;
      height: ${8 + Math.random()*10}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ---- INIT ----
loadData();
setInterval(loadData, 5 * 60 * 1000);
