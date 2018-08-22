const path = require('path')
const { get } = require('lodash')
const ChluIPFS = require('chlu-ipfs-support')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const { runCrawler } = require('./crawler')

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

    api.get('/id', async (req, res) => {
      try {
        this.log('GET ID => ...')
        await this.chluIpfs.waitUntilReady()
        const did = this.chluIpfs.didIpfsHelper.didId
        this.log(`GET ID => ${did}`)
        res.json({ did })
      } catch (error) {
        this.log(`GET ID => ERROR ${error.message}`)
        res.status(500).json(createError(error.message || 'Unknown error'))
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

    api.post('/crawl', async (req, res) => {
      try {
        this.log('POST CRAWL => ...')

        const data = req.body
        const crawlerType = data.type
        const crawlerUrl = data.url
        const crawlerDidId = data.didId

        if (!crawlerType) throw new Error("Missing type.")
        if (!crawlerUrl) throw new Error("Missing url.")
        if (!crawlerDidId) throw new Error("Missing DID ID.")

        await this.chluIpfs.waitUntilReady()
        await runCrawler(this.chluIpfs, crawlerDidId, crawlerType, crawlerUrl)

        res.json({
          success: true
        })
      } catch (err) {
        console.error(err.message)
        res.status(500).json(createError(err.message || 'Unknown Error'))
      }
    })

    return api
  }

}

function createError(message) {
  return { message }
}

module.exports = ChluAPIPublish
