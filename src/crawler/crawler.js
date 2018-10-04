const fetch = require('node-fetch')
const { transformUpworkData, transformNewApifyData } = require('./transform')

const crawlerMap = {
  yelp: getYelpReviews,
  upwork: getUpWorkReviews,
  fiverr: getFiverrReviews,
  linkedin: getLinkedInReviews,
  tripadvisor: getTripAdvisorReviews
}

async function getReviews(type, url, user, pass, secret, onStarted) {
  if (!crawlerMap[type]) {
    throw new Error(`Invalid crawler type '${type}'.`)
  }
  return await crawlerMap[type](url, user, pass, secret, onStarted)
}

async function getUpWorkReviews(url, user, pass, secret, onStarted) {
  if (!url) throw new Error("Missing 'url'.")

  let upworkData

  if (user && pass) {
    // Use new UpWork actor with login support
    upworkData = await runV2AsyncCrawler('XPS87bEfWSpvb8Kpo', '9qcDHSZabd8uG3F5DQoB2gyYc', {
      url: url,
      login: user,
      pass: pass,
      secret: secret
    }, onStarted)
    return transformNewApifyData(upworkData)
  } else {
    // Use legacy UpWork actor without login support
    const response = await runV2AsyncCrawler('PWaorZyrfNgetFoHp', '9qcDHSZabd8uG3F5DQoB2gyYc', {
      url: url
    })
    response.resultRaw = response.result
    response.result = transformUpworkData(response.result)
    return response
  }
}

async function getLinkedInReviews(url, user, pass, secret, onStarted) {
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  const response = await runV2AsyncCrawler('gYBQuWnfgsBc3hMHY', '9qcDHSZabd8uG3F5DQoB2gyYc', {
    user: user,
    pwd: pass
  }, onStarted)
  response.resultRaw = response.result
  response.result = transformNewApifyData(response.result)
  return response
}

async function getTripAdvisorReviews(url, user, pass, secret, onStarted) {
  if (!url) throw new Error("Missing 'url'.")
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  const response = await runV2AsyncCrawler('KJ23ZhcXaTruoaDQ4', '9qcDHSZabd8uG3F5DQoB2gyYc', {
    profileUrl: url,
    email: user,
    pass: pass
  }, onStarted)
  response.resultRaw = response.result
  response.result = transformNewApifyData(response.result)
  return response
}

async function getYelpReviews(url, user, pass, onStarted) {
  if (!url) throw new Error("Missing 'url'.")
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  // TODO: data transform?
  return runV2AsyncCrawler('4zxEDkuRom4fEJNkL', '9qcDHSZabd8uG3F5DQoB2gyYc', {
    siteUrl: url,
    email: user,
    pass: pass
  }, onStarted)
}

async function getFiverrReviews(url, user, pass, secret, onStarted) {
  if (!url) throw new Error("Missing 'url'.")
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  // TODO: data transform?
  return runV2AsyncCrawler('sPWyRGiZt3uQbQc8h', '9qcDHSZabd8uG3F5DQoB2gyYc', {
    url: url,
    login: user,
    pass: pass
  }, onStarted)
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