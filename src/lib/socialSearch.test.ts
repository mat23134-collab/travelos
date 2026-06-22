import assert from 'node:assert/strict';
import { placeSearchQuery, tiktokSearchUrl, instagramSearchUrl } from './socialSearch';

// Query joins name + city, trims, drops empties
assert.equal(placeSearchQuery('Ay-Chung Noodle', 'Taipei'), 'Ay-Chung Noodle Taipei');
assert.equal(placeSearchQuery('  Senso-ji  ', '  Tokyo '), 'Senso-ji Tokyo');
assert.equal(placeSearchQuery('Louvre', null), 'Louvre');
assert.equal(placeSearchQuery('Louvre', ''), 'Louvre');

// URLs are https, point at the right host, and URL-encode the query
const tt = tiktokSearchUrl('Ay-Chung Noodle', 'Taipei');
assert.ok(tt.startsWith('https://www.tiktok.com/search?q='));
assert.ok(tt.includes('Ay-Chung%20Noodle%20Taipei'));

const ig = instagramSearchUrl('Din Tai Fung', 'Taipei');
assert.ok(ig.startsWith('https://www.instagram.com/explore/search/keyword/?q='));
assert.ok(ig.includes('Din%20Tai%20Fung%20Taipei'));

console.log('✓ socialSearch: all assertions passed');
