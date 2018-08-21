
const { getYelpReviews, getUpWorkReviews } = require('./apify')
const { transformYelpData, transformUpworkData } = require('./transform')
const { getChluIPFS, importUnverifiedReviews } = require('./ipfs')

const crawlerMap = {
  yelp: getYelpReviews,
  upwork: getUpWorkReviews
}

const transformMap = {
  yelp: transformYelpData,
  upwork: transformUpworkData
}

async function runCrawler(did, type, url) {
  if (!crawlerMap[type] || !transformMap[type]) {
    throw new Error(`Invalid crawler type '${type}'.`)
  }

  const apifyResults = await crawlerMap[type](url)
  const results = transformMap[type](apifyResults)

  const chluIpfs = await getChluIPFS()
  await chluIpfs.importDID(did)
  await importUnverifiedReviews(results)
}

module.exports = {
  runCrawler
}
