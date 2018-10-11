const fetch = require('node-fetch')
const { invert } = require('lodash')
const { transformData } = require('./transform')

const crawlerMap = {
  yelp: '4zxEDkuRom4fEJNkL',
  upwork: 'XPS87bEfWSpvb8Kpo',
  upworkLegacy: 'PWaorZyrfNgetFoHp',
  fiverr: 'sPWyRGiZt3uQbQc8h',
  linkedin: 'gYBQuWnfgsBc3hMHY',
  tripadvisor: 'KJ23ZhcXaTruoaDQ4'
}

class Crawler {

  constructor(token){
    this.token = token
  }

  async startReviewImport(type, url, user, pass, secret) {
    if (type === 'upwork' && !user) {
      // Use legacy UpWork actor without login support
      type = 'upworkLegacy'
    }
    let actorId = crawlerMap[type]
    if (!actorId) {
      throw new Error(`Invalid crawler type '${type}'.`)
    }
    const crawlerData = await this.startCrawler(actorId, this.token, {
      url: url,
      login: user,
      pass: pass,
      secret: secret
    })
    return crawlerData
  }

  async getCrawlerResults(response) {
    if (response.data.status === 'SUCCEEDED') {
      const keyValueStoreId = response.data.defaultDatasetId
      const actorResultUrl = `https://api.apify.com/v2/datasets/${keyValueStoreId}/items?token=${this.token}`
      let result = null
      try {
        const response =  await fetch(actorResultUrl)
        result = await response.json()
      } catch (err) {
        console.log(err)
        throw new Error('Error while getting crawler results')
      }
      if (result && result.error) throw new Error(result.error.message || result.error)
      const actorId = response.requestData.actorId
      const type = invert(crawlerMap)[actorId]
      return transformData(type, result)
    } else if (response.data.status === 'FAILED') {
      throw new Error('Import procedure has failed')
    }
  }

  async startCrawler(actorId, postData) {
    const actorStartUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${this.token}`

    const startResponse = await fetch(actorStartUrl, {
      method: 'POST',
      body: JSON.stringify(postData),
      headers: {
        'content-type': 'application/json'
      },
    })

    const startResponseJson = await startResponse.json()
    const actorRunId = startResponseJson.data.id
    const actorStatusUrl = `https://api.apify.com/v2/acts/${actorId}/runs/${actorRunId}?token=${this.token}`
    const actorErrorUrl = `https://my.apify.com/actors/${actorId}#/runs/${actorRunId}`

    return {
      actorId,
      actorRunId,
      actorStartUrl,
      actorStatusUrl,
      actorErrorUrl
    }
  }

  async checkCrawler(actorId, actorRunId) {
    const actorStatusUrl = `https://api.apify.com/v2/acts/${actorId}/runs/${actorRunId}?token=${this.token}`
    const statusResponse = await fetch(actorStatusUrl)
    const response = await statusResponse.json()
    response.requestData = { actorId, actorRunId }
    return response
  }
}

module.exports = Crawler