
const { getYelpReviews, getUpWorkReviews, getFiverrReviews, getLinkedInReviews, getTripAdvisorReviews } = require('./apify')

const crawlerMap = {
  yelp: getYelpReviews,
  upwork: getUpWorkReviews,
  fiverr: getFiverrReviews,
  linkedin: getLinkedInReviews,
  tripadvisor: getTripAdvisorReviews
}

async function startCrawler(chluIpfs, didId, type, url, username, password) {
  if (!crawlerMap[type]) {
    throw new Error(`Invalid crawler type '${type}'.`)
  }

  const reviews = await crawlerMap[type](url, username, password)

  try {
    await chluIpfs.importUnverifiedReviews(reviews.map(r => {
      r.chlu_version = 0
      r.subject.did = didId
      return r
    }))
  } catch (err) {
    console.error('Failed to import the following crawled reviews:')
    console.error(JSON.stringify(reviews)) // .stringify isn't required here (for most cases), but let's just make sure.
    throw err;
  }
}

module.exports = {
  startCrawler
}
