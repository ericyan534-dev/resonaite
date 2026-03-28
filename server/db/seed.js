#!/usr/bin/env node

/**
 * Resonaite Database Seeder
 * Album names from the approved demo design, mapped by BPM
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');

const TEST_AUDIO_SOURCE = '/sessions/gifted-lucid-pasteur/mnt/Resonaite/resonaite_modulation/test_audio';
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, './resonaite.db');

// ── Album definitions from the approved demo design ─────────────────
// Each BPM maps to a named album from the original UI
const BPM_ALBUM_MAP = {
  48: {
    id: 'album-amber-horizon',
    title: 'Amber Horizon',
    description: 'The sun surrenders to the horizon, painting the sand in amber and rose.',
    mood_category: 'Sleep',
    c1: '#5c3a28', c2: '#d4956a'
  },
  50: {
    id: 'album-crystal-air',
    title: 'Crystal Air',
    description: 'Above the clouds, silence has a texture.',
    mood_category: 'Meditate',
    c1: '#353b5c', c2: '#b8c4d8'
  },
  52: {
    id: 'album-moonlit-shore',
    title: 'Moonlit Shore',
    description: 'Waves whisper secrets to the shore under moonlight.',
    mood_category: 'Sleep',
    c1: '#0d1b2a', c2: '#a8dadc'
  },
  55: {
    id: 'album-summit-silence',
    title: 'Summit Silence',
    description: 'The world below fades into memory.',
    mood_category: 'Meditate',
    c1: '#2d3250', c2: '#7886a0'
  },
  60: {
    id: 'album-tidal-memory',
    title: 'Tidal Memory',
    description: 'The last light dissolves into endless water.',
    mood_category: 'Relax',
    c1: '#1b3a5c', c2: '#457b9d'
  },
  66: {
    id: 'album-dune-walker',
    title: 'Dune Walker',
    description: 'Golden warmth embraces you across ancient sands.',
    mood_category: 'Focus',
    c1: '#402010', c2: '#f4c474'
  },
  68: {
    id: 'album-morning-dew',
    title: 'Morning Dew',
    description: 'The first light breaks through ancient canopy.',
    mood_category: 'Focus',
    c1: '#1B4332', c2: '#95D5B2'
  },
  72: {
    id: 'album-emerald-canopy',
    title: 'Emerald Canopy',
    description: 'Turning dewdrops into diamonds under a living roof.',
    mood_category: 'Focus',
    c1: '#2D6A4F', c2: '#52B788'
  }
};

function cleanTitle(filename) {
  let name = filename.replace(/\.[^/.]+$/, '');  // remove extension
  name = name.replace(/\d+$/, '').trim();         // remove trailing BPM
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function extractArtist(filename) {
  const known = {
    'alexander-nakarada': 'Alexander Nakarada',
    'scott-buckley': 'Scott Buckley',
    'punch-deck': 'Punch Deck',
    'barradeen': 'Barradeen',
    'rexlambo': 'Rexlambo',
    'alex-productions': 'Alex Productions',
    'fsm-team': 'FSM Team',
    'gudji': 'Gudji',
    'jay-someday': 'Jay Someday',
    'savfk': 'Savfk',
  };
  const lower = filename.toLowerCase();
  for (const [key, name] of Object.entries(known)) {
    if (lower.includes(key)) return name;
  }
  return 'Various Artists';
}

async function main() {
  try {
    console.log('Starting database seed...');

    const SQL = await initSqlJs();
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const sqlDb = new SQL.Database();

    // Execute schema
    const schema = fs.readFileSync(path.join(__dirname, './schema.sql'), 'utf8');
    sqlDb.run(schema);
    console.log('✓ Schema initialized');

    // Create dev user
    const devUserId = 'dev-user-001';
    const passwordHash = bcrypt.hashSync('dev123456', 12);
    sqlDb.run(
      `INSERT INTO users (id, email, password_hash, display_name, theme, preferences_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [devUserId, 'dev@resonaite.local', passwordHash, 'Developer', 'forest', '{}']
    );
    console.log('✓ Dev user: dev@resonaite.local / dev123456');

    // Create albums
    for (const [bpm, album] of Object.entries(BPM_ALBUM_MAP)) {
      sqlDb.run(
        `INSERT INTO albums (id, title, description, cover_gradient_1, cover_gradient_2, mood_category, track_count)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [album.id, album.title, album.description, album.c1, album.c2, album.mood_category]
      );
    }
    console.log(`✓ Created ${Object.keys(BPM_ALBUM_MAP).length} albums`);

    // Scan audio files
    let audioFiles = [];
    if (fs.existsSync(TEST_AUDIO_SOURCE)) {
      audioFiles = fs.readdirSync(TEST_AUDIO_SOURCE)
        .filter(f => /\.(mp3|wav|m4a|ogg|flac)$/i.test(f))
        .sort();
      console.log(`✓ Found ${audioFiles.length} audio files`);
    } else {
      console.warn('⚠ Test audio directory not found: ' + TEST_AUDIO_SOURCE);
    }

    // Insert tracks
    let tracksCreated = 0;
    for (const file of audioFiles) {
      try {
        const bpmMatch = file.match(/(\d+)(?:\.\w+)?$/);
        const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : null;
        if (!bpm || !BPM_ALBUM_MAP[bpm]) {
          console.warn(`  ⚠ Skipping ${file} (BPM ${bpm} not in album map)`);
          continue;
        }

        const album = BPM_ALBUM_MAP[bpm];
        const title = cleanTitle(file);
        const artist = extractArtist(file);
        const filePath = path.join(TEST_AUDIO_SOURCE, file);
        const trackId = `track-${String(tracksCreated + 1).padStart(3, '0')}`;

        sqlDb.run(
          `INSERT INTO tracks (id, title, artist, bpm, mood_category, source, file_path,
             cover_gradient_1, cover_gradient_2, album_id, created_by, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [trackId, title, artist, bpm, album.mood_category, 'test_audio', filePath,
           album.c1, album.c2, album.id, devUserId, '{}']
        );
        tracksCreated++;
        console.log(`  + ${title} → ${album.title} (${bpm} BPM)`);
      } catch (err) {
        console.warn(`  ⚠ Error processing ${file}: ${err.message}`);
      }
    }

    // Update album track counts
    for (const album of Object.values(BPM_ALBUM_MAP)) {
      const result = sqlDb.exec(`SELECT COUNT(*) as c FROM tracks WHERE album_id = '${album.id}'`);
      const count = result.length > 0 ? result[0].values[0][0] : 0;
      sqlDb.run('UPDATE albums SET track_count = ? WHERE id = ?', [count, album.id]);
    }

    // Save
    const data = sqlDb.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    sqlDb.close();

    console.log('\n══════════════════════════════════════════');
    console.log('  RESONAITE SEED COMPLETE');
    console.log('══════════════════════════════════════════');
    console.log(`  Dev User:  dev@resonaite.local / dev123456`);
    console.log(`  Albums:    ${Object.keys(BPM_ALBUM_MAP).length}`);
    console.log(`  Tracks:    ${tracksCreated}`);
    console.log(`  Database:  ${DB_PATH}`);
    console.log('══════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

main();
