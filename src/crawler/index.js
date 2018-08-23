
const { getYelpReviews, getUpWorkReviews, getFiverrReviews, getLinkedInReviews, getTripAdvisorReviews } = require('./apify')
const { transformYelpData, transformUpworkData } = require('./transform')

const crawlerMap = {
  yelp: getYelpReviews,
  upwork: getUpWorkReviews,
  fiverr: getFiverrReviews,
  linkedin: getLinkedInReviews,
  tripadvisor: getTripAdvisorReviews
}

const transformMap = {
  yelp: transformYelpData,
  upwork: transformUpworkData
}

async function runCrawler(chluIpfs, didId, type, url, username, password) {
  if (!crawlerMap[type] || !transformMap[type]) {
    throw new Error(`Invalid crawler type '${type}'.`)
  }

  const apifyResults = await crawlerMap[type](url, username, password)
  const reviews = transformMap[type](apifyResults)

  console.log("------------ CRAWLER SUCCEEDED ------------")
  console.log(reviews)

  await chluIpfs.importUnverifiedReviews(reviews.map(r => {
    r.chlu_version = 0
    r.subject.did = didId
    return r
  }))
  console.log("------------ REVIEW IMPORT SUCCEEDED ------------")
}

module.exports = {
  runCrawler
}
