const fetch = require('node-fetch')
const { transformUpworkData, transformNewApifyData } = require('./transform')

async function getUpWorkReviews(url, user, pass, secret) {
  if (!url) throw new Error("Missing 'url'.")

  let upworkData

  if (user && pass) {
    // Use new UpWork actor with login support
    upworkData = await runV2AsyncCrawler('XPS87bEfWSpvb8Kpo', '9qcDHSZabd8uG3F5DQoB2gyYc', {
      url: url,
      login: user,
      pass: pass,
      secret: secret
    })

    return transformNewApifyData(upworkData)
  } else {
    // Use legacy UpWork actor without login support
    upWorkData = await runV2AsyncCrawler('PWaorZyrfNgetFoHp', '9qcDHSZabd8uG3F5DQoB2gyYc', {
      url: url
    })

    return transformUpworkData(upWorkData)
  }
}

async function getLinkedInReviews(url, user, pass) {
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  let data = await runV2AsyncCrawler('gYBQuWnfgsBc3hMHY', '9qcDHSZabd8uG3F5DQoB2gyYc', {
    user: user,
    pwd: pass
  })

  return transformNewApifyData(data)
}

async function getTripAdvisorReviews(url, user, pass) {
  if (!url) throw new Error("Missing 'url'.")
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  let data = await runV2AsyncCrawler('KJ23ZhcXaTruoaDQ4', '9qcDHSZabd8uG3F5DQoB2gyYc', {
    profileUrl: url,
    email: user,
    pass: pass
  })

  return transformNewApifyData(data)
}

async function getYelpReviews(url, user, pass) {
  if (!url) throw new Error("Missing 'url'.")
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  return runV2AsyncCrawler('4zxEDkuRom4fEJNkL', '9qcDHSZabd8uG3F5DQoB2gyYc', {
    siteUrl: url,
    email: user,
    pass: pass
  })
}

async function getFiverrReviews(url, user, pass) {
  if (!url) throw new Error("Missing 'url'.")
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  return runV2AsyncCrawler('sPWyRGiZt3uQbQc8h', '9qcDHSZabd8uG3F5DQoB2gyYc', {
    url: url,
    login: user,
    pass: pass
  })
}

async function runV2AsyncCrawler(actorId, token, postData) {
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

  console.log('startResponse:')
  console.log(startResponseJson)

  let statusResponseJson

  do {
    let statusResponse = await fetch(actorStatusUrl)
    statusResponseJson = await statusResponse.json()

    console.log('statusResponse:')
    console.log(statusResponseJson)

    if (statusResponseJson.data.status !== 'RUNNING') {
      // The Actor is no longer running, which means it either finished, errored out, or was aborted.
      if (statusResponseJson.data.status !== 'SUCCEEDED') {
        const errorUrl = `https://my.apify.com/actors/${actorId}#/runs/${actorRunId}`

        throw new Error(`Actor run failed with status '${statusResponseJson.data.status}'. See ${errorUrl} for details.`)
      }

      break
    }

    // Still running, keep polling...
    await sleep(15000)
  } while (true)

  // If this point is reached, the Actor finished successfully.
  // The next step is to request output result data.
  const keyValueStoreId = statusResponseJson.data.defaultDatasetId
  const actorResultUrl = `https://api.apify.com/v2/datasets/${keyValueStoreId}/items?token=${token}`

  const resultResponse = await fetch(actorResultUrl)
  const resultResponseJson = await resultResponse.json()

  console.log('resultResponse:')
  console.log(resultResponseJson)

  if (resultResponseJson.error) {
    throw new Error(resultResponseJson.error.message)
  }

  return resultResponseJson
}

async function sleep(duration) {
  return new Promise(resolve => setTimeout(resolve, duration))
}

module.exports = {
  getUpWorkReviews,
  getTripAdvisorReviews,
  getYelpReviews,
  getFiverrReviews,
  getLinkedInReviews
}

// ==========================================================================
// Unused legacy stuff below
// ==========================================================================

async function startCrawler(crawlerUrl, postData) {
  const response = await fetch(crawlerUrl, {
    method: 'POST',
    body: JSON.stringify(postData),
    headers: {
      'content-type': 'application/json'
    },
  })

  const responseJson = await response.json()
  const result = await keepPolling(responseJson)

  return result
}

function keepPolling(apifyExecution) {
  return new Promise((resolve, reject) => {
    console.log(apifyExecution);

    if (apifyExecution.status !== 'SUCCEEDED' && apifyExecution.finishedAt === null) {
      console.log('setting timeout');

      setTimeout(function () {
        console.log('calling ' + apifyExecution.detailsUrl);

        fetch(apifyExecution.detailsUrl, { method: 'GET' })
          .then(function (response) { return response.json(); })
          .then(function (data) {
            const apifyExecution = data;

            keepPolling(apifyExecution)
              .then(resolve)
              .catch(reject);
          })
          .catch(reject);
      }, 10000);
    } else {
      console.log('completed...')
      console.log('calling ' + apifyExecution.resultsUrl)

      fetch(apifyExecution.resultsUrl, { method: 'GET' })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          console.log('RESULTS')
          console.log(data)
          try {
            const reviews = getCrawlerResults(data)
            console.log(reviews)
            resolve(reviews)
          } catch (error) {
            reject(error)
          }
        })
        .catch(reject);
    }
  })
}

function getCrawlerResults(apifyResults) {
  var reviews = [];
  for (var i in apifyResults) {
    if (apifyResults[i].errorInfo && apifyResults[i].loadErrorCode) {
      throw new Error(apifyResults[i].errorInfo)
    }
    for (var r in apifyResults[i].pageFunctionResult) {
      reviews.push((apifyResults[0].pageFunctionResult[r]));
    }
  }
  return reviews;
}
