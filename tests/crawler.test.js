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
      getReviews: sinon.stub().resolves({ result: [] })
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
    const { promise } = await chluApiPublish.crawler.startCrawlerInBackground(request)
    await promise // wait for crawling to finish
    const args = chluApiPublish.chluIpfs.didIpfsHelper.verifyMultihash.args[0]
    expect(args[0]).to.deep.equal(request.publicDidDocument)
    expect(args[1]).to.match(/^Qm/)
    expect(args[2]).to.deep.equal(request.signature)
    expect(chluApiPublish.crawler.crawler.getReviews.args[0].slice(0, 5)).to.deep.equal([
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
    const expectedStartResponse = { id: 'hello' }
    const expectedResponse = { result: [cloneDeep(fakeReview)] }
    chluApiPublish.crawler.crawler.getReviews = sinon.stub().callsFake(async (...arguments) => {
      const onStarted = arguments[5]
      expect((await chluApiPublish.db.getJob(didId, request.type)).status)
        .to.equal(chluApiPublish.db.STATUS.CREATED)
      await onStarted(expectedStartResponse)
      expect((await chluApiPublish.db.getJob(didId, request.type)).status)
        .to.equal(chluApiPublish.db.STATUS.RUNNING)
      return expectedResponse
    })
    expect((await chluApiPublish.db.getJob(didId, request.type)).status)
      .to.deep.equal(chluApiPublish.db.STATUS.MISSING)
    const { promise } = await chluApiPublish.crawler.startCrawlerInBackground(request)
    await promise // wait for crawler to end
    const reviews = [fakeReview]
    const reviewsInIpfs = chluApiPublish.crawler.prepareReviews(cloneDeep(reviews), didId)
    const result = pick(await chluApiPublish.db.getJob(didId, request.type), ['status', 'data'])
    const expected = {
      status: chluApiPublish.db.STATUS.SUCCESS,
      data: {
        crawlerRunResult: expectedResponse,
        crawlerRunData: expectedStartResponse
      }
    }
    expect(result).to.deep.equal(expected)
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
      throw new Error('Crawler failed')
    })
    expect((await chluApiPublish.db.getJob(didId, request.type)).status)
      .to.deep.equal(chluApiPublish.db.STATUS.MISSING)
    const events = new EventEmitter()
    async function startCrawler() {
      const result = await chluApiPublish.crawler.startCrawlerInBackground(request)
      await result.promise.catch(() => null) // ignore
      events.emit('completed')
    }
    await new Promise((resolve, reject) => {
      events.on('completed', async () => {
        try {
          expect(pick(await chluApiPublish.db.getJob(didId, request.type), ['status', 'data']))
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