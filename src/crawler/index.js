
const Crawler = require('./crawler')
const { createDAGNode } = require('chlu-ipfs-support/src/utils/ipfs')
const { set, omit, cloneDeep, isEmpty } = require('lodash')


class CrawlerManager {
  constructor(chluIpfs, db, logger) {
    this.chluIpfs = chluIpfs
    this.db = db
    this.crawler = Crawler
    this.log = logger
    this.syncAllJobsLoopTimeMs = 10000
    this.shouldPoll = false
    this.polling = false
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
      this.log(`Started Job ${type} for ${didId} with crawlerRunData: ${JSON.stringify(response)}`)
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

  start() {
    this.startSyncAllJobsLoop()
  }

  async stop() {
    await this.stopSyncAllJobsLoop()
  }

  startSyncAllJobsLoop(timeMs) {
    this.syncAllJobsLoopPromise = this.syncAllJobsLoop(timeMs)
  }

  async stopSyncAllJobsLoop() {
    this.shouldPoll = false // make it stop
    await this.syncAllJobsLoopPromise // wait for last cycle to end
  }

  async syncAllJobsLoop(timeMs = this.syncAllJobsLoopTimeMs) {
    this.shouldPoll = true
    this.polling = true
    while(this.shouldPoll) {
      try {
        this.log('Starting SyncAllJobs')
        await this.syncAllJobs()
        this.log(`Done SyncAllJobs. Repeating in ${timeMs} ms`)
      } catch(error) {
        this.log(`Failed to Sync all Jobs (loop), trying again in ${timeMs} ms`)
        console.log(error)
      }
      if (this.shouldPoll) {
        await new Promise(resolve => this.syncAllJobsLoopTimeout = setTimeout(resolve, timeMs))
      } else {
        this.log(`A stop request has been made, skipping SyncAllJobs wait time (${timeMs} ms)`)
      }
    }
    this.log('Stopping SyncAllJobs')
    this.polling = false
  }

  async syncAllJobs() {
    const jobs = await this.db.getAllPendingJobs()
    for (const job of jobs) await this.syncCrawlerState(job)
  }

  async syncUserCrawlersState(didId) {
    const jobs = await this.db.getAllPendingJobs({ did: didId })
    for (const job of jobs) await this.syncCrawlerState(job)
  }

  async syncCrawlerState(job) {
    try {
      this.log(`Syncing Job ${JSON.stringify(job)}`)
      if (job.status === 'MISSING') {
        this.log('Syncing import job: update impossible, job missing')
      } else if (job.status === 'IMPORTING') {
        const { service: type, did: didId } = job
        this.log(`Syncing import job about ${type} for ${didId}: IMPORT is in progress, skipping`)
      } else {
        const { service: type, did: didId } = job
        if (job.data && job.data.crawlerRunData && job.data.crawlerRunData.actorId && job.data.crawlerRunData.actorRunId) {
          const { actorId, actorRunId } = job.data.crawlerRunData
          this.log(`Syncing import job about ${type} for ${didId}`)
          const response = await this.crawler.checkCrawler(actorId, actorRunId)
          if (response.data.status !== job.status) {
            this.log(`Syncing import job about ${type} for ${didId}: updating status`)
            // Update status
            if (response.data.status === 'SUCCEEDED') {
              const results = await this.crawler.getCrawlerResults(response)
              if (!isEmpty(results)) {
                this.log(`Syncing import job about ${type} for ${didId}: job succeeded, setting status to IMPORTING`)
                job = await this.db.updateJob(didId, type, { crawlerRunResult: results }, this.db.STATUS.IMPORTING)
                this.log(`Syncing import job about ${type} for ${didId}: job succeeded, importing reviews`)
                await this.importReviewsInChlu(didId, type, results)
                this.log(`Syncing import job about ${type} for ${didId}: job succeeded, reviews imported`)
              } else {
                this.log(`Syncing import job about ${type} for ${didId}: job succeeded, but the job produced no results`)
              }
              this.log(`Syncing import job about ${type} for ${didId}: job succeeded, setting status to SUCCESS`)
              job = await this.db.updateJob(didId, type, null, this.db.STATUS.SUCCESS)
            } else {
              this.log(`Syncing import job about ${type} for ${didId}: job status changed to non-success state`)
              const statusMap = {
                FAILED: this.db.STATUS.ERROR,
                RUNNING: this.db.STATUS.RUNNING
              }
              const newStatus = statusMap[response.data.status]
              this.log(`Syncing import job about ${type} for ${didId}: setting job status to ${newStatus}`)
              job = await this.db.updateJob(didId, type,  { crawlerRunState: response }, newStatus)
            }
          } else {
            this.log(`Syncing import job about ${type} for ${didId}: update unneeded, status unchanged`)
          }
        } else {
          this.log(`Syncing import job about ${type} for ${didId}: can't sync due to missing crawler data`)
        }
      }
      const jobJson = typeof job.toJSON === 'function' ? job.toJSON() : job
      this.log(`Syncing import job: OK. New value ${JSON.stringify(jobJson)}`)
      return jobJson
    } catch (error) {
      console.log('Sync import job failed:')
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
