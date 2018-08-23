const fetch = require('node-fetch')

function getUpWorkReviews(url, user, pass) {
  if (!url) throw new Error("Missing 'url'.")
  // if (!user) throw new Error("Missing 'user'.")
  // if (!pass) throw new Error("Missing 'pass'.")

  const actorUrl = 'https://api.apify.com/v2/acts/PWaorZyrfNgetFoHp/run-sync?token=9qcDHSZabd8uG3F5DQoB2gyYc'
  const postData = {
    url: url,
    email: user,
    pass: pass
  }

  return syncActor(actorUrl, postData)
}

async function syncActor(url, postData) {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(postData),
    headers: {
      'Content-type': 'application/json'
    },
  })

  const responseJson = await response.json()
  if (responseJson.error) throw new Error(responseJson.error.message || responseJson.error)
  return responseJson
}

async function getLinkedInReviews(url, user, pass) {
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  const crawlerUrl = 'https://api.apify.com/v2/acts/gYBQuWnfgsBc3hMHY/runs?token=9qcDHSZabd8uG3F5DQoB2gyYc'
  const postData = {
    user: user,
    pwd: pass
  };

  return startCrawler(crawlerUrl, postData);
}

async function getTripAdvisorReviews(url, user, pass) {
  if (!url) throw new Error("Missing 'url'.")
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  const crawlerUrl = 'https://api.apify.com/v2/acts/KJ23ZhcXaTruoaDQ4/runs?token=9qcDHSZabd8uG3F5DQoB2gyYc'
  const postData = {
    profileUrl: url,
    email: user,
    pass: pass
  };

  return startCrawler(crawlerUrl, postData);
}

async function getYelpReviews(url, user, pass) {
  if (!url) throw new Error("Missing 'url'.")
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  const crawlerUrl = 'https://api.apify.com/v2/acts/4zxEDkuRom4fEJNkL/runs?token=9qcDHSZabd8uG3F5DQoB2gyYc'
  const postData = {
    siteUrl: url,
    email: user,
    pass: pass
  }

  return startCrawler(crawlerUrl, postData)
}

async function getFiverrReviews(url, user, pass) {
  if (!url) throw new Error("Missing 'url'.")
  if (!user) throw new Error("Missing 'user'.")
  if (!pass) throw new Error("Missing 'pass'.")

  const crawlerUrl = 'https://api.apify.com/v2/acts/sPWyRGiZt3uQbQc8h/runs?token=9qcDHSZabd8uG3F5DQoB2gyYc'
  const postData = {
    url: url,
    login: user,
    pass: pass
  }

  return startCrawler(crawlerUrl, postData)
}

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
      setTimeout(function(){
        console.log('calling ' + apifyExecution.detailsUrl);
        fetch(apifyExecution.detailsUrl, { method: 'GET' })
          .then(function(response) { return response.json(); })
          .then(function(data) {
            const apifyExecution = data;
            keepPolling(apifyExecution)
              .then(resolve)
              .catch(reject);
          })
          .catch(reject);
      }, 10000);
    } else {
      console.log('completed...');
      fetch(apifyExecution.resultsUrl, { method: 'GET' })
        .then(function(response) { return response.json(); })
        .then(function(data) {
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

function getCrawlerResults(apifyResults){
  var reviews = [];
  for(var i in apifyResults) {
    if (apifyResults[i].errorInfo && apifyResults[i].loadErrorCode) {
      throw new Error(apifyResults[i].errorInfo)
    }
    for(var r in apifyResults[i].pageFunctionResult) {
      reviews.push((apifyResults[0].pageFunctionResult[r]));
    }
  }
  return reviews;
}

module.exports = {
  getUpWorkReviews,
  getTripAdvisorReviews,
  getYelpReviews,
  getFiverrReviews,
  getLinkedInReviews
}
