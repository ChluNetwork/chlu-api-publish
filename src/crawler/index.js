
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

  console.log("------------ CRAWLER SUCCEEDED ------------")
  console.log(results)

  const chluIpfs = await getChluIPFS()
  console.log("------------ IPFS GET SUCCEEDED ------------")

  await chluIpfs.importDID(did)
  console.log("------------ DID IMPORT SUCCEEDED ------------")

  await importUnverifiedReviews(results)
  console.log("------------ REVIEW IMPORT SUCCEEDED ------------")
}

module.exports = {
  runCrawler
}
