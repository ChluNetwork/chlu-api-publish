const expect = require('chai').expect
const sinon = require('sinon')
const { pick, cloneDeep } = require('lodash')
const EventEmitter = require('events')
const ChluAPIPublish = require('../src')
const logger = require('chlu-ipfs-support/tests/utils/logger')

describe('Crawler Manager', () => {

  let chluApiPublish

  beforeEach(async () => {
    const chluIpfs = {
      importUnverifiedReviews: sinon.stub().resolves(),
      didIpfsHelper: {
        verifyMultihash: sinon.stub().resolves(true)
      },
      logger: logger('CrawlerManager'),
      start: sinon.stub().resolves(),
      stop: sinon.stub().resolves()
    }
    chluApiPublish = new ChluAPIPublish({ chluIpfs })
    chluApiPublish.api = {
      listen: sinon.stub().yieldsAsync() // calls the callback
    }
    chluApiPublish.crawler.crawler = {
      getReviews: sinon.stub().resolves([])
    }
    await chluApiPublish.start()
  })

  afterEach(async () => {
    await chluApiPublish.stop()
    chluApiPublish = null
  })

  it('calls the crawlers correctly', async () => {
    const didId = 'did:chlu:abc'
    const request = {
      type: 'upwork',
      url: 'https://myurl.com',
      username: 'developer',
      password: 'hunter2',
      secret: 'dontell',
      didId,
      publicDidDocument: { id: didId },
      signature: { signatureValue: 'mysig' }
    }
    const { promise } = await chluApiPublish.crawler.startCrawler(request)
    await promise // wait for crawling to finish
    const args = chluApiPublish.chluIpfs.didIpfsHelper.verifyMultihash.args[0]
    expect(args[0]).to.deep.equal(request.publicDidDocument)
    expect(args[1]).to.match(/^Qm/)
    expect(args[2]).to.deep.equal(request.signature)
    expect(chluApiPublish.crawler.crawler.getReviews.args[0]).to.deep.equal([
      request.type,
      request.url,
      request.username,
      request.password,
      request.secret
    ])
  })

  it('keeps the status in the db updated', async () => {
    const didId = 'did:chlu:def'
    const request = {
      type: 'upwork',
      url: 'https://myurl.com',
      username: 'developer',
      password: 'hunter2',
      secret: 'dontell',
      didId,
      publicDidDocument: { id: didId },
      signature: { signatureValue: 'mysig' }
    }
    const fakeReview = {
      review: {
        title: 'Review',
        text: 'Fake'
      }
    }
    chluApiPublish.crawler.crawler.getReviews = sinon.stub().callsFake(async () => {
      expect((await chluApiPublish.db.getJob(didId)).status)
        .to.equal(chluApiPublish.db.STATUS.RUNNING)
      return [cloneDeep(fakeReview)]
    })
    expect((await chluApiPublish.db.getJob(didId)).status)
      .to.deep.equal(chluApiPublish.db.STATUS.MISSING)
    const { promise } = await chluApiPublish.crawler.startCrawler(request)
    await promise // wait for crawler to end
    const reviews = [fakeReview]
    const reviewsInIpfs = chluApiPublish.crawler.prepareReviews(cloneDeep(reviews), didId)
    expect(pick(await chluApiPublish.db.getJob(didId), ['status', 'data']))
      .to.deep.equal({ status: chluApiPublish.db.STATUS.SUCCESS, data: { reviews } })
    expect(chluApiPublish.chluIpfs.importUnverifiedReviews.args[0][0]).to.deep.equal(reviewsInIpfs)
  })

  it('handles failing jobs', async () => {
    const didId = 'did:chlu:def'
    const request = {
      type: 'upwork',
      url: 'https://myurl.com',
      username: 'developer',
      password: 'hunter2',
      secret: 'dontell',
      didId,
      publicDidDocument: { id: didId },
      signature: { signatureValue: 'mysig' }
    }
    chluApiPublish.crawler.crawler.getReviews = sinon.stub().callsFake(async () => {
      expect((await chluApiPublish.db.getJob(didId)).status)
        .to.equal(chluApiPublish.db.STATUS.RUNNING)
      throw new Error('Crawler failed')
    })
    expect((await chluApiPublish.db.getJob(didId)).status)
      .to.deep.equal(chluApiPublish.db.STATUS.MISSING)
    const events = new EventEmitter()
    async function startCrawler() {
      const result = await chluApiPublish.crawler.startCrawler(request)
      await result.promise.catch(() => null) // ignore
      events.emit('completed')
    }
    await new Promise((resolve, reject) => {
      events.on('completed', async () => {
        try {
          expect(pick(await chluApiPublish.db.getJob(didId), ['status', 'data']))
            .to.deep.equal({ status: chluApiPublish.db.STATUS.ERROR, data: { error: 'Crawler failed' } })
          resolve()
        } catch (error) {
          reject(error)
        }
      })
      startCrawler()
    })
  })
})