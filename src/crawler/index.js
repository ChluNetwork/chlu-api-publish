
const Crawler = require('./crawler')
const { createDAGNode } = require('chlu-ipfs-support/src/utils/ipfs')
const { set, omit, cloneDeep, isEmpty } = require('lodash')


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
  
  async startCrawlerInBackground(data) {
    const type = data.type
    const url = data.url
    const didId = data.didId
    const user = data.username
    const pass = data.password
    const secret = data.secret

    await this.validateCrawlerRequest(data)
    let job = null
    try {
      job = await this.db.createJob(didId, type)
      const response = await this.crawler.startReviewImport(type, url, user, pass, secret)
      job = await this.db.updateJob(didId, type, { crawlerRunData: response }, this.db.STATUS.RUNNING)
      // When done
    } catch (error) {
      this.log(`Failed to crawl the reviews for ${didId}`)
      console.log(error)
      await this.db.setJobError(didId, type, error)
      throw error
    }
    return job
  }

  async syncAllJobs() {
    const jobs = await this.db.getAllPendingJobs()
    for (const job of jobs) await this.syncCrawlerState(job)
  }

  async syncUserCrawlersState(didId) {
    const jobs = await this.db.getJobs(didId, 0, 0, { status: this.db.STATUS.RUNNING })
    for (const job of jobs) await this.syncCrawlerState(job)
  }

  async syncCrawlerState(job) {
    try {
      if (job.status !== 'MISSING') {
        const { service: type, did: didId } = job
        const { actorId, actorRunId } = job.data.crawlerRunData
        const response = await this.crawler.checkCrawler(actorId, actorRunId)
        if (response.data.status !== job.status) {
          // Update status
          if (response.data.status === 'SUCCEEDED') {
            const results = await this.crawler.getCrawlerResults(response)
            if (!isEmpty(results)) {
              job = await this.db.updateJob(didId, type, { crawlerRunResult: results }, this.db.STATUS.IMPORTING)
              await this.importReviewsInChlu(didId, type, results)
            }
            job = await this.db.updateJob(didId, type, null, this.db.STATUS.SUCCESS)
          } else {
            const statusMap = {
              FAILED: this.db.STATUS.ERROR,
              RUNNING: this.db.status.RUNNING
            }
            job = await this.db.updateJob(didId, type,  { crawlerRunState: response }, statusMap[response.data.status])
          }
        }
      }
      return job
    } catch (error) {
      console.log('Sync crawler state failed:')
      console.log(error)
    }
  }

  async importReviewsInChlu(didId, type, reviews) {
    try {
      await this.chluIpfs.importUnverifiedReviews(this.prepareReviewsForChlu(cloneDeep(reviews), didId))
      await this.db.updateJob(didId, type, null, this.db.STATUS.SUCCESS)
    } catch (error) {
      this.log(`Failed to import the crawled reviews for ${didId}`)
      console.log(error)
      await this.db.setJobError(didId, type, error)
      throw error
    }
  }

  prepareReviewsForChlu(reviews, didId) {
    return reviews.map(r => {
      set(r, 'chlu_version', 0)
      set(r, 'subject.did', didId)
      // TODO: Insert additional information
      return r
    })
  }
}

module.exports = CrawlerManager
