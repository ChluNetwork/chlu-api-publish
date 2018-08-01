const path = require('path')
const { get } = require('lodash')
const ChluIPFS = require('chlu-ipfs-support')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

class ChluAPIPublish {
    constructor(config = {}) {
        const chluIpfsConfig = get(config, 'chluIpfsConfig', {})
        const directory = path.join(process.env.HOME, '.chlu-publish')
        if (!chluIpfsConfig.directory) chluIpfsConfig.directory = directory
        this.chluIpfs = get(config, 'chluIpfs', null)
        if (!this.chluIpfs) this.chluIpfs = new ChluIPFS(chluIpfsConfig)
        this.port = get(config, 'port', 3006)
        this.logger = get(config, 'logger', this.chluIpfs.logger)
        this.prepareAPI()
        this.log = msg => this.logger.debug(`[API] ${msg}`)
    }

    async start() {
        await this.chluIpfs.start()
        this.log('Starting HTTP Server')
        await new Promise(resolve => this.api.listen(this.port, resolve))
        this.log(`Started HTTP Server on port ${this.port}`)
    }

    async stop() {
        await this.chluIpfs.stop()
    }

    prepareAPI() {
        this.api = express()
        this.api.use(cors())
        this.api.use(bodyParser.json())
        this.api.get('/', (req, res) => res.send('Chlu API Publish').end())
        const apiv1 = this.prepareAPIV1()
        this.api.use('/api/v1', apiv1)
    }

    prepareAPIV1() {
        const api = express()

        api.post('/reviews', async (req, res) => {
            const publish = get(req, 'query.publish', false) === 'true'
            const expectedMultihash = get(req, 'query.expectedMultihash', null)
            const bitcoinTransactionHash = get(req, 'query.bitcoinTransactionHash', null)
            this.log(`Storing Review Record, publish: ${publish ? 'yes' : 'no'}, bitcoinTransactionHash: ${bitcoinTransactionHash}`)
            try {
                const reviewRecord = req.body
                const result = await this.chluIpfs.storeReviewRecord(reviewRecord, {
                    bitcoinTransactionHash,
                    expectedMultihash,
                    publish
                })
                this.log(`Stored Review Record, publish: ${publish ? 'yes' : 'no'}, bitcoinTransactionHash: ${bitcoinTransactionHash} => ${result}`)
                res.json(result)
            } catch (error) {
                this.log(`Storing Review Record, publish: ${publish ? 'yes' : 'no'}, bitcoinTransactionHash: ${bitcoinTransactionHash} => ERROR ${error.message}`)
                console.error(error)
                res.status(500).json(createError(error.message || 'Unknown Error'))
            }
        })

        api.post('/dids', async (req, res) => {
            const waitForReplication = get(req, 'query.waitForReplication', false) === 'true'
            const data = req.body
            const publicDidDocument = get(data, 'publicDidDocument', null)
            const signature = get(data, 'signature', null)
            const didId = get(publicDidDocument, 'id', null)
            if (!publicDidDocument) {
                this.log(`Published DID ${didId} WaitForReplication: ${waitForReplication ? 'yes' : 'no'} => 400 Bad Request`)
                res.status(400).json(createError('Missing publicDidDocument'))
            } else if (!signature) {
                this.log(`Published DID ${didId} WaitForReplication: ${waitForReplication ? 'yes' : 'no'} => 400 Bad Request`)
                res.status(400).json(createError('Missing signature'))
            } else {
                this.log(`Publishing DID ${didId} WaitForReplication: ${waitForReplication ? 'yes' : 'no'}`)
                try {
                    const result = await this.chluIpfs.publishDID(publicDidDocument, signature, waitForReplication)
                    this.log(`Published DID ${didId} WaitForReplication: ${waitForReplication ? 'yes' : 'no'} => OK`)
                    res.json(result)
                } catch (error) {
                    this.log(`Published DID ${didId} WaitForReplication: ${waitForReplication ? 'yes' : 'no'} => ERROR ${error.message}`)
                    console.error(error)
                    res.status(500).json(createError(error.message || 'Unknown Error'))
                }
            }
        })

        return api
    }

}

function createError(message) {
    return { message }
}

module.exports = ChluAPIPublish