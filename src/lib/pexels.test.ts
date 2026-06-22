import assert from 'node:assert/strict';
import { mapPexelsPhoto } from './pexels';

const photo = {
  src: {
    original:  'https://img/original.jpg',
    landscape: 'https://img/landscape.jpg',
    portrait:  'https://img/portrait.jpg',
    medium:    'https://img/medium.jpg',
  },
  photographer: 'Winston Chen',
  photographer_url: 'https://pexels.com/@winston',
};

// landscape → src.landscape
const land = mapPexelsPhoto(photo, 'landscape');
assert.equal(land?.image_url, 'https://img/landscape.jpg');
assert.equal(land?.photographer, 'Winston Chen');
assert.equal(land?.photographer_url, 'https://pexels.com/@winston');

// portrait → src.portrait
assert.equal(mapPexelsPhoto(photo, 'portrait')?.image_url, 'https://img/portrait.jpg');

// square has no dedicated src → falls back to landscape then original
assert.equal(mapPexelsPhoto(photo, 'square')?.image_url, 'https://img/landscape.jpg');

// missing the requested orientation → falls back to the other, then original
const noLandscape = { ...photo, src: { original: 'https://img/o.jpg', portrait: 'https://img/p.jpg' } };
assert.equal(mapPexelsPhoto(noLandscape, 'landscape')?.image_url, 'https://img/p.jpg');
const onlyOriginal = { ...photo, src: { original: 'https://img/o.jpg' } };
assert.equal(mapPexelsPhoto(onlyOriginal, 'landscape')?.image_url, 'https://img/o.jpg');

// no usable url → null
assert.equal(mapPexelsPhoto({ src: {}, photographer: 'X' }, 'landscape'), null);

// missing photographer fields → null (not undefined)
const noPhotog = { src: { landscape: 'https://img/l.jpg' } };
const m = mapPexelsPhoto(noPhotog, 'landscape');
assert.equal(m?.image_url, 'https://img/l.jpg');
assert.equal(m?.photographer, null);
assert.equal(m?.photographer_url, null);

console.log('All pexels mapper tests passed ✅');
