const ChluIPFS = require('chlu-ipfs-support')

let chluIpfsSingleton = null

async function getChluIPFS() {
  const isProduction = process.env.NODE_ENV === 'production'
  const defaultNetwork = isProduction ? ChluIPFS.networks.staging : ChluIPFS.networks.experimental
  const options = {
    network: process.env.CHLU_NETWORK || defaultNetwork,
    bitcoinNetwork: process.env.BLOCKCYPHER_RESOURCE || 'test3',
    blockCypherApiKey: process.env.BLOCKCYPHER_TOKEN
  }
  if (!chluIpfsSingleton) {
    chluIpfsSingleton = new ChluIPFS(options)
    await chluIpfsSingleton.start()

    chluIpfsSingleton.events.on('reviewrecord/updated', (multihash, updatedMultihash, reviewRecord) => {

    })
  } else {
    await chluIpfsSingleton.waitUntilReady()
  }
  return chluIpfsSingleton;
}

async function readReviews(didId) {
  const chluIpfs = await getChluIPFS()
  const multihashes = await chluIpfs.getReviewsByDID(didId)
  const reviews = []
  for (const multihash of multihashes) {
    reviews.push(await chluIpfs.readReviewRecord(multihash))
  }
  return reviews
}

async function importUnverifiedReviews(reviews) {
  const chluIpfs = await getChluIPFS()
  return await chluIpfs.importUnverifiedReviews(reviews.map(r => {
    r.chlu_version = 0
    // set this to myself so that it gets indexed right in Chlu
    r.subject.did = chluIpfs.didIpfsHelper.didId
    return r
  }))
}

module.exports = {
  getChluIPFS,
  readReviews,
  importUnverifiedReviews
}
