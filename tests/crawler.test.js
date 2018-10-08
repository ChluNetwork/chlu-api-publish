const expect = require('chai').expect
const sinon = require('sinon')
const { pick, cloneDeep } = require('lodash')
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
      startReviewImport: sinon.stub().resolves({ actorId: 'a', actorRunId: '1' }),
      checkCrawler: sinon.stub().resolves({ data: { status: 'RUNNING' }}),
      getCrawlerResults: sinon.stub().resolves([])
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
    await chluApiPublish.crawler.startCrawlerInBackground(request)
    const args = chluApiPublish.chluIpfs.didIpfsHelper.verifyMultihash.args[0]
    expect(args[0]).to.deep.equal(request.publicDidDocument)
    expect(args[1]).to.match(/^Qm/)
    expect(args[2]).to.deep.equal(request.signature)
    expect(chluApiPublish.crawler.crawler.startReviewImport.args[0]).to.deep.equal([
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
    const expectedResponse = { data: { status: 'RUNNING' } }
    // Check before start
    expect((await chluApiPublish.db.getJob(didId, request.type)).status)
      .to.deep.equal(chluApiPublish.db.STATUS.MISSING)
    chluApiPublish.crawler.crawler.startReviewImport = sinon.stub().callsFake(async () => {
      expect((await chluApiPublish.db.getJob(didId, request.type)).status)
        .to.equal(chluApiPublish.db.STATUS.CREATED)
      return expectedStartResponse
    })
    await chluApiPublish.crawler.startCrawlerInBackground(request)
    // Check after start
    expect((await chluApiPublish.db.getJob(didId, request.type)).status)
      .to.equal(chluApiPublish.db.STATUS.RUNNING)
    // Check after sync
    chluApiPublish.crawler.crawler.checkCrawler = sinon.stub().resolves(expectedResponse)
    await chluApiPublish.crawler.syncAllJobs()
    expect((await chluApiPublish.db.getJob(didId, request.type)).status)
      .to.equal(chluApiPublish.db.STATUS.RUNNING)
    // Check results after sync with state success
    const reviews = [fakeReview]
    const crawlerRunResult = {
      data: { status: 'SUCCEEDED', defaultDataSetId: 'data1' },
      requestData: { actorId: 'a', actorRunId: '1' }
    }
    chluApiPublish.crawler.crawler.checkCrawler = sinon.stub().resolves(crawlerRunResult)
    chluApiPublish.crawler.crawler.getCrawlerResults = sinon.stub().resolves(reviews)
    await chluApiPublish.crawler.syncAllJobs()
    const reviewsInIpfs = chluApiPublish.crawler.prepareReviewsForChlu(cloneDeep(reviews), didId)
    const result = pick(await chluApiPublish.db.getJob(didId, request.type), ['status', 'data'])
    const expected = {
      status: chluApiPublish.db.STATUS.SUCCESS,
      data: {
        crawlerRunData: expectedStartResponse,
        crawlerRunResult: reviews
      }
    }
    expect(result).to.deep.equal(expected)
    expect(chluApiPublish.chluIpfs.importUnverifiedReviews.args[0][0]).to.deep.equal(reviewsInIpfs)
  })

  it.skip('handles failing jobs', async () => {
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
    // TODO: Start process to import, then check and verify the FAILED state is handled
  })
})