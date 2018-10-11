#!/usr/bin/env node
const ChluAPIPublish = require('./index.js');
const ChluSQLIndex = require('chlu-ipfs-support/src/modules/orbitdb/indexes/sql')
const cli = require('commander');
const package = require('../package.json');

let server = null

function handleErrors(fn) {
  return function (...args) {
    fn(...args).catch(err => {
      console.log(err);
      console.trace(err);
      process.exit(1);
    });
  };
}

async function start(options){
  console.log('Starting Chlu API Query');
  if (!options.btc) {
    console.warn('\nWARNING: BTC Blockchain access through BlockCypher is strongly suggested\n');
  }
  const config = {
    port: options.port,
    network: options.network,
    directory: options.directory,
    blockCypherApiKey: options.btc,
    bitcoinNetwork: options.btcNetwork,
    OrbitDBIndex: ChluSQLIndex,
    OrbitDBIndexOptions: {
      dialect: options.chluPostgres ? 'postgres' : undefined,
      host: options.chluDatabaseHost,
      port: options.chluDatabasePort,
      storage: options.chluPostgres ? null : options.chluDatabaseName,
      database: options.chluPostgres ? options.chluDatabaseName : null,
      username: options.chluDatabaseUser,
      password: options.chluDatabasePassword,
      enableWrites: options.chluWrite,
      enableValidations: options.chluWrite
    },
    db: {
      dialect: options.postgres ? 'postgres' : undefined,
      host: options.databaseHost,
      port: options.databasePort,
      storage: options.postgres ? null : options.databaseName,
      database: options.postgres ? options.databaseName : null,
      username: options.databaseUser,
      password: options.databasePassword,
    },
    mailer: {
      host: options.smtpHost,
      port: options.smtpPort,
      smtpPassword: options.smtpPassword,
      smtpUser: options.smtpUser,
      secure: options.smtpSecure,
      sender: options.emailSender,
      replyTo: options.emailReplyTo
    }
  };
  server = new ChluAPIPublish({
    port: options.port,
    chluIpfsConfig: config,
    token: options.crawlerToken
  });
  await server.start();
}

process.on('SIGINT', async function() {
  try {
    console.log('Stopping gracefully');
    if (server) await server.stop();
    console.log('Goodbye!');
    process.exit(0);
  } catch(exception) {
    console.trace(exception);
    process.exit(1);
  }
});


cli
  .name('chlu-api-publish')
  .description('Reference implementation of the Chlu Publish API. http://chlu.io')
  .version(package.version);

cli
  .command('start')
  .description('run the Chlu Publish API Server')
// Service specific options
  .option('-p, --port <port>', 'use a custom port, defaults to 3006')
// Chlu specific options
  .option('-n, --network <network>', 'use a custom Chlu network instead of experimental')
  .option('-d, --directory <path>', 'where to store Chlu data, defaults to ~/.chlu-publish')
// Blockchain
  .option('--btc <token>', 'turn on BTC Blockchain access using a Blockcypher API Token. Other systems will be supported in the future')
  .option('--btc-network <network>', 'choose the BTC network you want to connect to. Default is test3')
// Crawler
  .option('--crawler-token <token>', 'provide this to enable importing reviews from centralised services')
// DB Options
  .option('--postgres', 'use postgres database instead of SQLite for the API Publish Server')
  .option('--database-host <s>')
  .option('--database-name <s>')
  .option('--database-user <s>')
  .option('--database-password <s>')
// ChluDB Options
  .option('--chlu-postgres', 'use postgres database instead of SQLite for Chlu data')
  .option('--chlu-no-write', 'disable writing to ChluDB. Only use this if you have a collector writing to the same DB')
  .option('--chlu-database-host <s>')
  .option('--chlu-database-port <s>')
  .option('--chlu-database-name <s>')
  .option('--chlu-database-user <s>')
  .option('--chlu-database-password <s>')
// Email options
  .option('--smtp-host <s>')
  .option('--smtp-port <s>')
  .option('--smtp-user <s>')
  .option('--smtp-password <s>')
  .option('--smtp-secure <s>')
  .option('--email-sender <s>')
  .option('--email-reply-to <s>')
  .action(handleErrors(async cmd => {
    await start(cmd);
  }));

cli.parse(process.argv);

if (!process.argv.slice(2).length) {
  cli.help();
}
