/**
 * Google Play Store scraper module
 * Fetches app metadata, reviews, and similar apps
 */

const gplay = require('google-play-scraper').default;

/**
 * Search for an app on the Play Store by name
 * Returns the best match app ID
 */
async function searchApp(appName) {
  const results = await gplay.search({
    term: appName,
    num: 5,
    lang: 'en',
    country: 'us',
  });

  if (!results || results.length === 0) {
    throw new Error(`No Play Store results found for: ${appName}`);
  }

  // Return top result
  return results[0];
}

/**
 * Fetch full app metadata from Play Store
 */
async function getAppDetails(appId) {
  const details = await gplay.app({
    appId,
    lang: 'en',
    country: 'us',
  });

  return {
    platform: 'android',
    appId: details.appId,
    title: details.title,
    developer: details.developer,
    developerId: details.developerId,
    description: details.description,
    summary: details.summary,
    score: details.score,
    ratings: details.ratings,
    reviews: details.reviews,
    installs: details.installs,
    minInstalls: details.minInstalls,
    maxInstalls: details.maxInstalls,
    price: details.price,
    free: details.free,
    currency: details.currency,
    genre: details.genre,
    genreId: details.genreId,
    categories: details.categories,
    icon: details.icon,
    headerImage: details.headerImage,
    screenshots: details.screenshots || [],
    contentRating: details.contentRating,
    version: details.version,
    updated: details.updated,
    released: details.released,
    size: details.size,
    androidVersion: details.androidVersion,
    url: details.url,
    histogram: details.histogram, // rating distribution {1: n, 2: n, 3: n, 4: n, 5: n}
  };
}

/**
 * Fetch recent reviews from Play Store
 */
async function getReviews(appId, count = 200) {
  const result = await gplay.reviews({
    appId,
    lang: 'en',
    country: 'us',
    sort: gplay.sort.NEWEST,
    num: count,
  });

  return result.data || [];
}

/**
 * Fetch similar/competitor apps from Play Store
 */
async function getSimilarApps(appId) {
  const similar = await gplay.similar({
    appId,
    lang: 'en',
    country: 'us',
  });

  return similar || [];
}

/**
 * Full data pull for a single app by name
 */
async function pullAppData(appName, appId = null) {
  console.log(`[Play Store] Searching for: ${appName}`);

  let resolvedAppId = appId;

  if (!resolvedAppId) {
    const searchResult = await searchApp(appName);
    resolvedAppId = searchResult.appId;
    console.log(`[Play Store] Found: ${searchResult.title} (${resolvedAppId})`);
  }

  const [details, reviews, similar] = await Promise.all([
    getAppDetails(resolvedAppId),
    getReviews(resolvedAppId, 200),
    getSimilarApps(resolvedAppId),
  ]);

  return {
    details,
    reviews,
    similar: similar.slice(0, 10), // top 10 similar apps
  };
}

module.exports = { searchApp, getAppDetails, getReviews, getSimilarApps, pullAppData };
