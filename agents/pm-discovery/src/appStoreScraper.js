/**
 * Apple App Store scraper module
 * Fetches app metadata, reviews, and similar apps
 */

const store = require('app-store-scraper');

/**
 * Search for an app on the App Store by name
 * Returns the best match
 */
async function searchApp(appName) {
  const results = await store.search({
    term: appName,
    num: 5,
    country: 'us',
    lang: 'en-us',
  });

  if (!results || results.length === 0) {
    throw new Error(`No App Store results found for: ${appName}`);
  }

  return results[0];
}

/**
 * Fetch full app metadata from App Store
 */
async function getAppDetails(appId) {
  const details = await store.app({
    id: appId,
    country: 'us',
    lang: 'en-us',
  });

  return {
    platform: 'ios',
    appId: details.appId,
    id: details.id,
    title: details.title,
    developer: details.developer,
    developerId: details.developerId,
    description: details.description,
    summary: details.description?.substring(0, 200),
    score: details.score,
    ratings: details.reviews,  // App Store uses 'reviews' for the rating count
    reviews: details.reviews,
    price: details.price,
    free: details.free,
    currency: details.currency,
    genres: details.genres,
    genreIds: details.genreIds,
    primaryGenre: details.primaryGenre,
    primaryGenreId: details.primaryGenreId,
    icon: details.icon,
    screenshots: details.screenshots || [],
    ipadScreenshots: details.ipadScreenshots || [],
    contentRating: details.contentRating,
    version: details.version,
    updated: details.updated,
    released: details.released,
    size: details.size,
    requiredOsVersion: details.requiredOsVersion,
    url: details.url,
    histogram: details.histogram, // rating distribution
    languages: details.languages,
    supportedDevices: details.supportedDevices,
  };
}

/**
 * Fetch recent reviews from App Store
 */
async function getReviews(appId, count = 200) {
  const allReviews = [];
  const pages = Math.ceil(count / 50); // App Store returns max 50 per page

  for (let page = 1; page <= Math.min(pages, 10); page++) {
    try {
      const pageReviews = await store.reviews({
        id: appId,
        country: 'us',
        sort: store.sort.RECENT,
        page,
      });

      if (!pageReviews || pageReviews.length === 0) break;
      allReviews.push(...pageReviews);

      if (allReviews.length >= count) break;
    } catch (err) {
      // Some pages may not exist
      break;
    }
  }

  return allReviews.slice(0, count);
}

/**
 * Fetch similar/competitor apps from App Store
 */
async function getSimilarApps(appId) {
  try {
    const similar = await store.similar({
      id: appId,
      country: 'us',
    });
    return similar || [];
  } catch (err) {
    console.warn(`[App Store] Could not fetch similar apps for ${appId}:`, err.message);
    return [];
  }
}

/**
 * Full data pull for a single app by name
 */
async function pullAppData(appName, appId = null) {
  console.log(`[App Store] Searching for: ${appName}`);

  let resolvedAppId = appId;

  if (!resolvedAppId) {
    const searchResult = await searchApp(appName);
    resolvedAppId = searchResult.id;
    console.log(`[App Store] Found: ${searchResult.title} (${resolvedAppId})`);
  }

  const [details, reviews, similar] = await Promise.all([
    getAppDetails(resolvedAppId),
    getReviews(resolvedAppId, 200),
    getSimilarApps(resolvedAppId),
  ]);

  return {
    details,
    reviews,
    similar: similar.slice(0, 10),
  };
}

module.exports = { searchApp, getAppDetails, getReviews, getSimilarApps, pullAppData };
