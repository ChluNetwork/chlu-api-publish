const fetch = require('node-fetch')
const { transformData } = require('./transform')

const token = '9qcDHSZabd8uG3F5DQoB2gyYc'

const crawlerMap = {
  yelp: '4zxEDkuRom4fEJNkL',
  upwork: 'XPS87bEfWSpvb8Kpo',
  upworkLegacy: 'PWaorZyrfNgetFoHp',
  fiverr: 'sPWyRGiZt3uQbQc8h',
  linkedin: 'gYBQuWnfgsBc3hMHY',
  tripadvisor: 'KJ23ZhcXaTruoaDQ4'
}

async function getReviews(type, url, user, pass, secret, onStarted) {
  if (type === 'upwork' && !user) {
    // Use legacy UpWork actor without login support
    type = 'upworkLegacy'
  }
  let actorId = crawlerMap[type]
  if (!actorId) {
    throw new Error(`Invalid crawler type '${type}'.`)
  }
  const crawlerData = await runV2AsyncCrawler(actorId, token, {
    url: url,
    login: user,
    pass: pass,
    secret: secret
  }, onStarted)
  return transformData(type, crawlerData)
}

async function startV2AsyncCrawler(actorId, token, postData) {
  const actorStartUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${token}`

  const startResponse = await fetch(actorStartUrl, {
    method: 'POST',
    body: JSON.stringify(postData),
    headers: {
      'content-type': 'application/json'
    },
  })

  const startResponseJson = await startResponse.json()
  const actorRunId = startResponseJson.data.id
  const actorStatusUrl = `https://api.apify.com/v2/acts/${actorId}/runs/${actorRunId}?token=${token}`
  const actorErrorUrl = `https://my.apify.com/actors/${actorId}#/runs/${actorRunId}`

  return {
    actorId,
    actorRunId,
    actorStartUrl,
    actorStatusUrl,
    actorErrorUrl
  }
}

async function awaitV2AsyncCrawler(actorId, token, actorRunId) {
  const actorStatusUrl = `https://api.apify.com/v2/acts/${actorId}/runs/${actorRunId}?token=${token}`
  const actorErrorUrl = `https://my.apify.com/actors/${actorId}#/runs/${actorRunId}`
  let error = null
  let result = null
  let done = false, response
  
  try {
    do {
      response = await checkV2AsyncCrawler(actorId, actorRunId, token)

      if (response.data.status !== 'RUNNING') {
        done = true
        // The Actor is no longer running, which means it either finished, errored out, or was aborted.
        if (response.data.status !== 'SUCCEEDED') {
          error = 'Import procedure has failed.'
        }
      }

      if (!done) await sleep(15000)
    } while (!done)

    // If this point is reached, the Actor finished successfully.
    // The next step is to request output result data.
    const keyValueStoreId = response.data.defaultDatasetId
    const actorResultUrl = `https://api.apify.com/v2/datasets/${keyValueStoreId}/items?token=${token}`

    if (!error) {
      try {
        const response =  await fetch(actorResultUrl)
        result = await response.json()
        if (result.error) throw new Error(result.error.message || result.error)
      } catch (err) {
        console.log(err)
        error = err.message || err
      }
    }
  } catch (err) {
    console.log(err)
    error = err.message || err
  }

  return {
    result,
    actorStatusUrl,
    actorId,
    actorRunId,
    actorErrorUrl,
    error
  }
}

async function checkV2AsyncCrawler(actorId, actorRunId, token) {
  const actorStatusUrl = `https://api.apify.com/v2/acts/${actorId}/runs/${actorRunId}?token=${token}`
  const statusResponse = await fetch(actorStatusUrl)
  const response = await statusResponse.json()
  return response
}

async function runV2AsyncCrawler(actorId, token, postData, onStarted) {
  const startResult = await startV2AsyncCrawler(actorId, token, postData) 
  if (typeof onStarted === 'function') await onStarted(startResult, token)
  const result = await awaitV2AsyncCrawler(actorId, token, startResult.actorRunId)
  return result
}

async function sleep(duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

module.exports = {
  getReviews
}