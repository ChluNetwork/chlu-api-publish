const path = require('path')
const { get, set } = require('lodash')
const ChluIPFS = require('chlu-ipfs-support')
const DB = require('./db')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const Crawler = require('./crawler')

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
    if (!get(config, 'db.storage') && this.chluIpfs.directory) {
      set(config, 'db.storage', path.join(this.chluIpfs.directory, 'api-publish-server.sqlite'))
    }
    this.db = new DB(config.db)
    this.crawler = new Crawler(this.chluIpfs, this.db)
  }

  async start() {
    this.log('Opening DB')
    await this.db.start()
    this.log('Starting Chlu IPFS')
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

    api.get('/crawl', async (req, res) => {
      try {
        const crawlerDidId = req.query.didid
        if (crawlerDidId) {
          this.log(`GET CRAWL ${crawlerDidId} => ...`)
          const data = await this.db.getJob(crawlerDidId)
          this.log(`GET CRAWL ${crawlerDidId} => ${JSON.stringify(data)}`)
          res.json(data)
        } else {
          res.status(400).json(createError('Missing DID ID.'))
        }
      } catch (error) {
        this.log(`GET CRAWL => ERROR ${error.message}`)
        res.status(500).json(createError(error.message || 'Unknown error'))
      }
    })

    api.post('/crawl', async (req, res) => {
      try {
        this.log('POST CRAWL => ...')
        const data = req.body
        if (!get(data, 'publicDidDocument.id')) {
          res.status(400).json(createError('Missing public did document'))
        } else {
          await this.crawler.startCrawler(data)
          res.json({ status: DB.STATUS.RUNNING })
        }
      } catch (err) {
        console.error('Crawler finished with an error:')
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
