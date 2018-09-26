
const Crawler = require('./crawler')
const { createDAGNode } = require('chlu-ipfs-support/src/utils/ipfs')
const { omit } = require('lodash')


class CrawlerManager {
  constructor(chluIpfs, db) {
    this.chluIpfs = chluIpfs
    this.db = db
    this.runningCrawlers = new Map()
    this.crawler = Crawler
  }

  async validateCrawlerRequest(data) {
    const crawlerDidId = data.didId
    const publicDidDocument = data.publicDidDocument
    const signature = data.signature
    // Check signature
    const multihash = (await createDAGNode(Buffer.from(JSON.stringify(omit(data, ['signature', 'publicDidDocument']))))).toJSON().multihash
    const valid = await this.chluIpfs.didIpfsHelper.verifyMultihash(publicDidDocument || crawlerDidId, multihash, signature)
    return valid
  }
  
  async startCrawler(data) {
    const type = data.type
    const url = data.url
    const didId = data.didId
    const user = data.username
    const pass = data.password
    const secret = data.secret

    const valid = await this.validateCrawlerRequest(data)
    if (!valid) {
      throw new Error('Invalid signature')
    }
    // This promise should not be awaited
    // but has to be catched to avoid crashes
    this.crawl(didId, type, url, user, pass, secret)
      .catch(err => console.error(err)) // TODO: better error handling
  }

  async crawl(didId, type, url, username, password, secret) {
    let reviews = []
    try {
      reviews = await this.crawler.getReviews(type, url, username, password, secret)
      await this.db.updateJob(didId, { data: { reviews } })
    } catch (error) {
      console.error(`Failed to crawl the reviews for ${didId}`)
      await this.db.updateJob(didId, { status: this.db.status.ERROR })
      throw error
    }
    if(reviews) await this.importReviews(didId, reviews)
  }

  async importReviews(didId, reviews) {
    try {
      await this.chluIpfs.importUnverifiedReviews(reviews.map(r => {
        r.chlu_version = 0
        r.subject.did = didId
        // TODO: Insert additional information
        return r
      }))
      await this.db.updateJob(didId, { status: this.db.STATUS.SUCCESS })
    } catch (error) {
      console.error(`Failed to import the crawled reviews for ${didId}`)
      await this.db.updateJob(didId, { status: this.db.STATUS.ERROR })
      throw error
    }
  }
}

module.exports = CrawlerManager
