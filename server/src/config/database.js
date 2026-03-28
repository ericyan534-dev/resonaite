const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let dbPath = null;

/**
 * Wrapper around sql.js to provide a better-sqlite3 compatible API
 * This allows us to use the same query patterns throughout the app
 */
class DatabaseWrapper {
  constructor(sqlDb, filePath) {
    this._db = sqlDb;
    this._path = filePath;
  }

  /**
   * Execute SQL that doesn't return results (CREATE, INSERT, UPDATE, DELETE)
   */
  exec(sql) {
    this._db.run(sql);
    this._save();
  }

  /**
   * Prepare a statement - returns a statement-like object with run/get/all methods
   */
  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        const stmt = self._db.prepare(sql);
        if (params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])) {
          // Named parameters
          stmt.bind(params[0]);
        } else if (params.length > 0) {
          stmt.bind(params);
        }
        stmt.step();
        stmt.free();
        self._save();
        return { changes: self._db.getRowsModified(), lastInsertRowid: null };
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        if (params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])) {
          stmt.bind(params[0]);
        } else if (params.length > 0) {
          stmt.bind(params);
        }
        const result = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return result;
      },
      all(...params) {
        const results = [];
        const stmt = self._db.prepare(sql);
        if (params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])) {
          stmt.bind(params[0]);
        } else if (params.length > 0) {
          stmt.bind(params);
        }
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  _save() {
    if (this._path) {
      try {
        const data = this._db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this._path, buffer);
      } catch (e) {
        console.error('Failed to save database:', e.message);
      }
    }
  }

  close() {
    this._save();
    this._db.close();
  }
}

/**
 * Initialize database with schema
 * Auto-seeds dev user + demo data if database is empty
 */
async function initDatabase() {
  const SQL = await initSqlJs();
  // In production (Cloud Run), use /tmp for writable database
  const defaultDbPath = process.env.NODE_ENV === 'production'
    ? '/tmp/resonaite.db'
    : path.join(__dirname, '../../db/resonaite.db');
  dbPath = process.env.DATABASE_PATH || defaultDbPath;
  const dbDir = path.dirname(dbPath);

  // Ensure database directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Open existing or create new database
  let sqlDb;
  let isNew = true;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    if (fileBuffer.length > 0) {
      try {
        sqlDb = new SQL.Database(fileBuffer);
        isNew = false;
      } catch (e) {
        console.warn('Database file corrupted, creating fresh database');
        sqlDb = new SQL.Database();
      }
    } else {
      sqlDb = new SQL.Database();
    }
  } else {
    sqlDb = new SQL.Database();
  }

  db = new DatabaseWrapper(sqlDb, dbPath);

  // Read and execute schema
  const schemaPath = path.join(__dirname, '../../db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    // Execute each statement separately
    const statements = schema.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          db.exec(stmt + ';');
        } catch (e) {
          // Ignore "table already exists" errors
          if (!e.message.includes('already exists')) {
            console.error('Schema error:', e.message);
          }
        }
      }
    }
    console.log(`Database initialized at ${dbPath}`);
  } else {
    console.warn(`Schema file not found at ${schemaPath}`);
  }

  // Auto-seed if database has no users (first run or fresh DB)
  await autoSeedIfEmpty();

  return db;
}

/**
 * Auto-seed dev user and mood-clustered albums if the database is empty.
 * Albums are organized by emotional character, not BPM.
 */
async function autoSeedIfEmpty() {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
    if (userCount && userCount.c > 0) return; // Already has data

    console.log('Empty database detected — auto-seeding dev data...');
    const bcrypt = require('bcryptjs');

    // ── Dev user ─────────────────────────────────────────
    const devUserId = 'dev-user-001';
    const passwordHash = bcrypt.hashSync('dev123456', 12);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, theme, preferences_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(devUserId, 'dev@resonaite.local', passwordHash, 'Developer', 'forest', '{}');
    console.log('  + Dev user created: dev@resonaite.local / dev123456');

    // ── 9 mood-clustered albums ──────────────────────────
    const ALBUMS = [
      { id: 'album-still-waters',   title: 'Still Waters',   desc: 'Gentle currents of sound that ease the mind into tranquil stillness.',              mood: 'Relax', c1: '#1a3a4a', c2: '#5ba4b5' },
      { id: 'album-morning-light',  title: 'Morning Light',  desc: 'Calm, soothing tones to greet the day with warmth and clarity.',                    mood: 'Relax', c1: '#3a4a2a', c2: '#a8c97a' },
      { id: 'album-deep-currents',  title: 'Deep Currents',  desc: 'Contemplative flows that sharpen thought and deepen concentration.',                mood: 'Focus', c1: '#2a2d45', c2: '#6b7db3' },
      { id: 'album-inner-compass',  title: 'Inner Compass',  desc: 'Pensive, introspective pieces for moments of quiet reflection.',                    mood: 'Focus', c1: '#2d3a45', c2: '#7a9bb5' },
      { id: 'album-tender-hearts',  title: 'Tender Hearts',  desc: 'Warm, heartfelt melodies that wrap around you like a soft embrace.',                mood: 'Relax', c1: '#4a2a3a', c2: '#c48da0' },
      { id: 'album-golden-hour',    title: 'Golden Hour',    desc: 'Reflective warmth and moving compositions for the end of day.',                     mood: 'Relax', c1: '#4a3a1a', c2: '#d4a85a' },
      { id: 'album-moonlit-dreams', title: 'Moonlit Dreams', desc: 'Wistful lullabies and nocturnal drifts to carry you into sleep.',                   mood: 'Sleep', c1: '#0d1b2a', c2: '#a8b8d8' },
      { id: 'album-starfall',       title: 'Starfall',       desc: 'Deep ambient textures and ethereal soundscapes for the deepest rest.',              mood: 'Sleep', c1: '#1a0d2a', c2: '#8a6db8' },
      { id: 'album-horizon',        title: 'Horizon',        desc: 'Uplifting and cinematic pieces that expand the mind and inspire momentum.',         mood: 'Focus', c1: '#2a1a0d', c2: '#c89a6a' },
    ];

    for (const album of ALBUMS) {
      db.prepare(
        `INSERT INTO albums (id, title, description, cover_gradient_1, cover_gradient_2, mood_category, track_count)
         VALUES (?, ?, ?, ?, ?, ?, 0)`
      ).run(album.id, album.title, album.desc, album.c1, album.c2, album.mood);
    }
    console.log(`  + Created ${ALBUMS.length} albums`);

    // ── Complete track catalog (73 tracks across 9 albums) ──
    // Each entry: [filename, title, artist, albumId]
    const TRACK_CATALOG = [
      // ═══ Still Waters (Relax) — Serene, gentle ═══ 8 tracks
      ['Norman Dück - Ein kurzer Augenblick.mp3', 'Ein kurzer Augenblick', 'Norman Dück', 'album-still-waters'],
      ["Wanderer's Trove - Midsummer Waltz.mp3", 'Midsummer Waltz', "Wanderer's Trove", 'album-still-waters'],
      ['麗美 - Before it Gets Dark.mp3', 'Before it Gets Dark', '麗美', 'album-still-waters'],
      ['Melody of Sound - Morning Song.mp3', 'Morning Song', 'Melody of Sound', 'album-still-waters'],
      ['Piano i - 어제보다 오늘 더 사랑합니다.mp3', 'Today I Love You More', 'Piano i', 'album-still-waters'],
      ['Lekk - Glass Stone.mp3', 'Glass Stone', 'Lekk', 'album-still-waters'],
      ['Phil Servati - Golden Oak.mp3', 'Golden Oak', 'Phil Servati', 'album-still-waters'],
      ['Omri Grummet, Nadav Amir-Himmel - Fusionnelle.mp3', 'Fusionnelle', 'Omri Grummet & Nadav Amir-Himmel', 'album-still-waters'],

      // ═══ Morning Light (Relax) — Calm, soothing ═══ 8 tracks
      ['Josh Kramer - Toivoa.mp3', 'Toivoa', 'Josh Kramer', 'album-morning-light'],
      ['Sean Oban - Ripples.mp3', 'Ripples', 'Sean Oban', 'album-morning-light'],
      ['小瀬村晶 - Asymptote.mp3', 'Asymptote', '小瀬村晶', 'album-morning-light'],
      ['Moux - with me, with you.mp3', 'With Me, With You', 'Moux', 'album-morning-light'],
      ['alex-productions-free-relaxing-chill-music-arnor60.mp3', 'Arnor', 'Alex Productions', 'album-morning-light'],
      ['scott-buckley-discovery60.mp3', 'Discovery', 'Scott Buckley', 'album-morning-light'],
      ['barradeen-my-way55.mp3', 'My Way', 'Barradeen', 'album-morning-light'],
      ['rexlambo-sunrise55.mp3', 'Sunrise', 'Rexlambo', 'album-morning-light'],

      // ═══ Deep Currents (Focus) — Contemplative, classical ═══ 8 tracks
      ['Lekk - Wurzeln.mp3', 'Wurzeln', 'Lekk', 'album-deep-currents'],
      ['Jenna Zabrosky - Irises.mp3', 'Irises', 'Jenna Zabrosky', 'album-deep-currents'],
      ['Klur, Ole-Bjørn Talstad - Entangled (Ole-Bjørn Talstad Rework).mp3', 'Entangled', 'Klur & Ole-Bjørn Talstad', 'album-deep-currents'],
      ['Ali Toygar - Octaves.mp3', 'Octaves', 'Ali Toygar', 'album-deep-currents'],
      ['Alva Brunel - Study for Proun.mp3', 'Study for Proun', 'Alva Brunel', 'album-deep-currents'],
      ['Alexis Ffrench - Songbird (Solo Piano Version).mp3', 'Songbird', 'Alexis Ffrench', 'album-deep-currents'],
      ['Alexis Ffrench - At Last (Solo Piano Version).mp3', 'At Last', 'Alexis Ffrench', 'album-deep-currents'],
      ['Alexis Ffrench - Rivers (Solo Piano Version).mp3', 'Rivers', 'Alexis Ffrench', 'album-deep-currents'],

      // ═══ Inner Compass (Focus) — Pensive, introspective ═══ 8 tracks
      ['下山亮平 - 花と木漏れ日.mp3', '花と木漏れ日', '下山亮平', 'album-inner-compass'],
      ['William Cas - Hour of Rest.mp3', 'Hour of Rest', 'William Cas', 'album-inner-compass'],
      ["Josh Alexander - Where There's Breath, There's Hope.mp3", "Where There's Breath, There's Hope", 'Josh Alexander', 'album-inner-compass'],
      ['Jase Moran - Aegean Fantaisie.mp3', 'Aegean Fantaisie', 'Jase Moran', 'album-inner-compass'],
      ['Leef Kjos - Hjem.mp3', 'Hjem', 'Leef Kjos', 'album-inner-compass'],
      ['Phil Servati - Wind of Change.mp3', 'Wind of Change', 'Phil Servati', 'album-inner-compass'],
      ['Ever So Blue - Onthou.mp3', 'Onthou', 'Ever So Blue', 'album-inner-compass'],
      ['scott-buckley-what-we-dont-say60.mp3', "What We Don't Say", 'Scott Buckley', 'album-inner-compass'],

      // ═══ Tender Hearts (Relax) — Poignant, heartfelt ═══ 8 tracks
      ['Alexis Ffrench - One (Solo Piano Version).mp3', 'One', 'Alexis Ffrench', 'album-tender-hearts'],
      ['Alexis Ffrench - Heartbeats (Solo Piano Version).mp3', 'Heartbeats', 'Alexis Ffrench', 'album-tender-hearts'],
      ['Luke Faulkner - Life and loss.mp3', 'Life and Loss', 'Luke Faulkner', 'album-tender-hearts'],
      ['Luke Faulkner - Daydreaming.mp3', 'Daydreaming', 'Luke Faulkner', 'album-tender-hearts'],
      ['Phildel - The Kiss.mp3', 'The Kiss', 'Phildel', 'album-tender-hearts'],
      ['Alexis Ffrench - Simple Gifts.mp3', 'Simple Gifts', 'Alexis Ffrench', 'album-tender-hearts'],
      ['Alexis Ffrench - Exhale.mp3', 'Exhale', 'Alexis Ffrench', 'album-tender-hearts'],
      ['Chad Lawson - Dance You Pretty.mp3', 'Dance You Pretty', 'Chad Lawson', 'album-tender-hearts'],

      // ═══ Golden Hour (Relax) — Reflective, warm, moving ═══ 8 tracks
      ['Saiakoup - Ribls.mp3', 'Ribls', 'Saiakoup', 'album-golden-hour'],
      ['Dennis Kuo - Track in Time (Piano Version).mp3', 'Track in Time', 'Dennis Kuo', 'album-golden-hour'],
      ['Melody of Sound - Hymn For us.mp3', 'Hymn For Us', 'Melody of Sound', 'album-golden-hour'],
      ['Valentina Romano - Ombre.mp3', 'Ombre', 'Valentina Romano', 'album-golden-hour'],
      ['Jozef De Schutter - Lyrides.mp3', 'Lyrides', 'Jozef De Schutter', 'album-golden-hour'],
      ['scott-buckley-a-kind-of-hope55.mp3', 'A Kind of Hope', 'Scott Buckley', 'album-golden-hour'],
      ['scott-buckley-she-moved-mountains55.mp3', 'She Moved Mountains', 'Scott Buckley', 'album-golden-hour'],
      ['scott-buckley-there-is-a-place50.mp3', 'There Is a Place', 'Scott Buckley', 'album-golden-hour'],

      // ═══ Moonlit Dreams (Sleep) — Wistful, nocturnal ═══ 8 tracks
      ['西村由紀江 - やさしさ.mp3', 'やさしさ', '西村由紀江', 'album-moonlit-dreams'],
      ['Alexis Ffrench - Together At Last.mp3', 'Together At Last', 'Alexis Ffrench', 'album-moonlit-dreams'],
      ['Itoko Toma - Yokaze.mp3', 'Yokaze', 'Itoko Toma', 'album-moonlit-dreams'],
      ['Alexis Ffrench - Wishing.mp3', 'Wishing', 'Alexis Ffrench', 'album-moonlit-dreams'],
      ['土星皇家交响乐团 - 肖邦：降E大调夜曲, Op. 9 No. 2.mp3', 'Nocturne Op. 9 No. 2', 'Chopin', 'album-moonlit-dreams'],
      ['Johannes Bornlöf - Turtle Swim.mp3', 'Turtle Swim', 'Johannes Bornlöf', 'album-moonlit-dreams'],
      ['Rob Simonsen - Blue.mp3', 'Blue', 'Rob Simonsen', 'album-moonlit-dreams'],
      ['Alexis Ffrench, Royal Liverpool Philharmonic Orchestra, James Morgan, Graham Devine - Dreamland.mp3', 'Dreamland', 'Alexis Ffrench', 'album-moonlit-dreams'],

      // ═══ Starfall (Sleep) — Deep ambient, ethereal ═══ 9 tracks
      ['Dennis Kuo - A Broken Heart Heals with Time.mp3', 'A Broken Heart Heals with Time', 'Dennis Kuo', 'album-starfall'],
      ['Ben Crosland - The Turn.mp3', 'The Turn', 'Ben Crosland', 'album-starfall'],
      ['alexander-nakarada-burt-s-requiem48.mp3', "Burt's Requiem", 'Alexander Nakarada', 'album-starfall'],
      ['scott-buckley-computations-in-a-snowstorm48.mp3', 'Computations in a Snowstorm', 'Scott Buckley', 'album-starfall'],
      ['Borealis48.mp3', 'Borealis', 'Various Artists', 'album-starfall'],
      ['1 Hour Sleep Assist_Meditation Music - Fall Asleep - Alexander Nakarada52.mp3', 'Sleep Assist', 'Alexander Nakarada', 'album-starfall'],
      ['punch-deck-ethereal50.mp3', 'Ethereal', 'Punch Deck', 'album-starfall'],
      ['scott-buckley-the-distant-sun50.mp3', 'The Distant Sun', 'Scott Buckley', 'album-starfall'],
      ['fsm-team-escp-twilight-city66.mp3', 'Twilight City', 'FSM Team', 'album-starfall'],

      // ═══ Horizon (Focus) — Uplifting, epic, energetic ═══ 8 tracks
      ['alexander-nakarada-fjeld68.mp3', 'Fjeld', 'Alexander Nakarada', 'album-horizon'],
      ['alexander-nakarada-uplifting-ballad68.mp3', 'Uplifting Ballad', 'Alexander Nakarada', 'album-horizon'],
      ['savfk-the-path68.mp3', 'The Path', 'Savfk', 'album-horizon'],
      ['fsm-team-eagle72.mp3', 'Eagle', 'FSM Team', 'album-horizon'],
      ['jay-someday-glory72.mp3', 'Glory', 'Jay Someday', 'album-horizon'],
      ['gudji-autumn-waltz66.mp3', 'Autumn Waltz', 'Gudji', 'album-horizon'],
      ['sunset66.mp3', 'Sunset', 'Various Artists', 'album-horizon'],
      ['Savfk - Another Door66.wav', 'Another Door', 'Savfk', 'album-horizon'],
    ];

    // ── Find audio directory ─────────────────────────────
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const audioDir = path.join(uploadsDir, 'test_audio');

    let trackNum = 0;
    let skipped = 0;
    for (const [filename, title, artist, albumId] of TRACK_CATALOG) {
      const filePath = `test_audio/${filename}`;
      const fullPath = path.join(uploadsDir, filePath);

      if (!fs.existsSync(fullPath)) {
        console.warn(`  ! Missing: ${filename}`);
        skipped++;
        continue;
      }

      trackNum++;
      const trackId = `track-${String(trackNum).padStart(3, '0')}`;
      const album = ALBUMS.find(a => a.id === albumId);
      const hue1 = Math.abs(title.charCodeAt(0) * 7) % 360;
      const hue2 = (hue1 + 40) % 360;

      db.prepare(
        `INSERT INTO tracks (id, title, artist, mood_category, source, file_path,
           cover_gradient_1, cover_gradient_2, album_id, created_by, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(trackId, title, artist, album ? album.mood : 'Relax', 'local', filePath,
        album ? album.c1 : `hsl(${hue1},40%,25%)`, album ? album.c2 : `hsl(${hue2},50%,35%)`,
        albumId, devUserId, '{}');
    }

    // Update album track counts
    for (const album of ALBUMS) {
      const result = db.prepare('SELECT COUNT(*) as c FROM tracks WHERE album_id = ?').get(album.id);
      const count = result ? result.c : 0;
      db.prepare('UPDATE albums SET track_count = ? WHERE id = ?').run(count, album.id);
    }

    console.log(`  + Imported ${trackNum} tracks (${skipped} missing files skipped)`);
    console.log('  + Auto-seed complete!\n');
  } catch (e) {
    console.error('Auto-seed warning:', e.message);
  }
}

/**
 * Get database instance
 * @returns {DatabaseWrapper} database instance with prepare/exec methods
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

module.exports = {
  initDatabase,
  getDb
};
