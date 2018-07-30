const ChluAPIPublish = require('../src')
const sinon = require('sinon')
const expect = require('chai').expect
const request = require('supertest')
const logger = require('chlu-ipfs-support/tests/utils/logger')

describe('HTTP server', () => {

    let chluApiPublish, chluIpfs, app

    before(() => {
        // disable logs
        process.env.DISABLE_LOGS = '1'
    })

    beforeEach(() => {
        chluIpfs = {
            start: sinon.stub().resolves(),
            storeReviewRecord: sinon.stub().resolves('Qmabc'),
            publishDID: sinon.stub().resolves(),
            did: {
                isDIDID: sinon.stub().resolves(true)
            },
            logger: logger('API Server')
        }
        chluApiPublish = new ChluAPIPublish({ chluIpfs })
        app = request(chluApiPublish.api)
    })

    it('starts correctly', async () => {
        expect(chluApiPublish.start).to.be.a('function')
        chluApiPublish.api = {
            listen: sinon.stub().callsFake((port, cb) => cb())
        }
        await chluApiPublish.start()
        expect(chluApiPublish.port).to.equal(3006)
        expect(chluIpfs.start.called).to.be.true
        expect(chluApiPublish.api.listen.calledWith(chluApiPublish.port)).to.be.true
    })

    it('/', async () => {
        await app.get('/').expect(200)
    })

    describe('/api/v1', () => {

        it('POST /dids', async () => {
            const did = {
                publicDidDocument: { id: 'did:chlu:abc' },
                signature: { signatureValue: 'ipromisethisislegit' }
            }
            await app.post('/api/v1/dids')
                .send(did)
                .set('Accept', 'application/json')
                .expect(200)
        })

        it('POST /reviews', async () => {
            const reviewRecord = { hello: 'world' }
            await app.post('/api/v1/reviews')
                .send(reviewRecord)
                .set('Accept', 'application/json')
                .expect(200, '"Qmabc"')
        })


    })

})