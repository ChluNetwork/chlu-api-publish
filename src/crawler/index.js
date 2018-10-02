
const Crawler = require('./crawler')
const { createDAGNode } = require('chlu-ipfs-support/src/utils/ipfs')
const { set, omit, cloneDeep } = require('lodash')


class CrawlerManager {
  constructor(chluIpfs, db, logger) {
    this.chluIpfs = chluIpfs
    this.db = db
    this.crawler = Crawler
    this.log = logger
  }

  async validateCrawlerRequest(data) {
    const crawlerDidId = data.didId
    const type = data.type
    const existing = await this.db.hasPendingJobs(crawlerDidId, type)
    if (existing > 0) {
      throw new Error('An import job for the requested service is already in progress')
    }
    const publicDidDocument = data.publicDidDocument
    const signature = data.signature
    // Check signature
    const multihash = (await createDAGNode(Buffer.from(JSON.stringify(omit(data, ['signature', 'publicDidDocument']))))).toJSON().multihash
    const valid = await this.chluIpfs.didIpfsHelper.verifyMultihash(publicDidDocument || crawlerDidId, multihash, signature)
    if (!valid) throw new Error('Signature is invalid')
    return valid
  }
  
  async startCrawler(data) {
    const type = data.type
    const url = data.url
    const didId = data.didId
    const user = data.username
    const pass = data.password
    const secret = data.secret

    await this.validateCrawlerRequest(data)
    // This promise should not be awaited
    // but has to be catched to avoid crashes
    const promise = this.crawl(didId, type, url, user, pass, secret)
      .catch(err => console.error(err)) // TODO: better error handling
    return { promise }
  }

  async crawl(didId, type, url, username, password, secret) {
    let reviews = []
    try {
      await this.db.createJob(didId, type, this.db.STATUS.RUNNING)
      const response = await this.crawler.getReviews(type, url, username, password, secret)
      reviews = response.result
      await this.db.updateJob(didId, type, { response })
      if (response.error) throw new Error(response.error)
    } catch (error) {
      this.log(`Failed to crawl the reviews for ${didId}`)
      console.log(error)
      await this.db.setJobError(didId, type, error)
      throw error
    }
    if (reviews) await this.importReviews(didId, type, reviews)
  }

  async importReviews(didId, type, reviews) {
    try {
      await this.chluIpfs.importUnverifiedReviews(this.prepareReviews(cloneDeep(reviews), didId))
      await this.db.updateJob(didId, type, null, this.db.STATUS.SUCCESS)
    } catch (error) {
      this.log(`Failed to import the crawled reviews for ${didId}`)
      console.log(error)
      await this.db.setJobError(didId, type, error)
      throw error
    }
  }

  prepareReviews(reviews, didId) {
    return reviews.map(r => {
      set(r, 'chlu_version', 0)
      set(r, 'subject.did', didId)
      // TODO: Insert additional information
      return r
    })
  }
}

module.exports = CrawlerManager
