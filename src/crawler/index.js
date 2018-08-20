import { getYelpReviews, getUpWorkReviews } from './apify'
import { transformYelpData, transformUpworkData } from './transform'
import { getChluIPFS, importUnverifiedReviews } from './ipfs'

const crawlerMap = {
  yelp: getYelpReviews,
  upwork: getUpWorkReviews
}

const transformMap = {
  yelp: transformYelpData,
  upwork: transformUpworkData
}

export async function runCrawler(did, type, url) {
  if (!crawlerMap[type] || !transformMap[type]) {
    throw new Error(`Invalid crawler type '${type}'.`)
  }

  const apifyResults = await crawlerMap[type](url)
  const results = transformMap[type](apifyResults)

  const chluIpfs = await getChluIPFS()
  await chluIpfs.importDID(did)
  await importUnverifiedReviews(results)
}
