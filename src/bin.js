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
        network: options.network,
        directory: options.directory,
        blockCypherApiKey: options.btc,
        bitcoinNetwork: options.btcNetwork,
        OrbitDBIndex: ChluSQLIndex,
        OrbitDBIndexOptions: {
            dialect: options.postgres ? 'postgres' : null,
            host: options.databaseHost,
            port: options.databasePort,
            username: options.databaseUser,
            password: options.databasePassword,
            enableWrites: options.write,
            enableValidations: options.write
        },
    };
    server = new ChluAPIPublish({
        port: options.port,
        chluIpfsConfig: config
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
    // Chlu specific options
    .option('-n, --network <network>', 'use a custom Chlu network instead of experimental')
    .option('-d, --directory <path>', 'where to store Chlu data, defaults to ~/.chlu-publish')
    // Blockchain
    .option('--btc <token>', 'turn on BTC Blockchain access using a Blockcypher API Token. Other systems will be supported in the future')
    .option('--btc-network <network>', 'choose the BTC network you want to connect to. Default is test3')
    // ChluDB Options
    .option('--postgres', 'connect to PostgreSQL database, uses SQLite otherwise')
    .option('--no-write', 'disable database writes, useful if you have a Chlu Collector writing to the same database')
    .option('--database-host <s>', 'defaults to localhost')
    .option('--database-port <s>', 'defatuls to the default postgresql port')
    .option('--database-db <s>', 'defatuls to \'chlu\'')
    .option('--database-user <s>', 'defatuls to \'chlu\'')
    .option('--database-password <s>', 'defatuls to empty password', null, '')
    .action(handleErrors(async cmd => {
        await start(cmd);
    }));

cli.parse(process.argv);

if (!process.argv.slice(2).length) {
    cli.help();
}