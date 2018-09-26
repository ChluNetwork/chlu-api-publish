const Sequelize = require('sequelize');
const path = require('path');
const { ensureDir } = require('./utils/fs');

const STATUS = {
  RUNNING: 'RUNNING',
  CREATED: 'CREATED',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  MISSING: 'MISSING'
}

class DB {

  constructor(options = {}) {
    this.STATUS = STATUS
    this.storage = options.storage || ':memory:';
    this.dialect = options.dialect || 'sqlite';
    this.username = options.username || 'username';
    this.password = options.password;
    this.host = options.host || 'localhost';
    this.port = options.port;
    this.dbName = options.dbName || 'chlu-api-publish';
  }

  async start() {
    if(!this.db) {
      if (!this.storage !== ':memory:') {
        await ensureDir(path.dirname(this.storage));
      }
      this.db = new Sequelize(this.dbName, this.username, this.password, {
        dialect: this.dialect,
        storage: this.storage,
        host: this.host,
        port: this.port,
        logging: this.logging || false,
        operatorsAliases: false
      });
      this.Job = this.db.define('job', {
        did: {
          type: Sequelize.STRING,
          unique: true
        },
        status: {
          type: Sequelize.STRING
        },
        data: {
          type: Sequelize.JSON
        }
      });
      await this.db.sync();
    }
  }

  async createJob(did, data = null) {
    await this.Job.create({
      did,
      status: STATUS.CREATED,
      data
    })
    return did
  }

  async updateJob(did, data) {
    const job = await this.Job.findOne({
      where: { did }
    })
    await job.update(data)
  }

  async getJob(did) {
    const job = await this.Job.findOne({
      where: { did }
    })
    if (job) {
      return job.toJSON()
    } else {
      return { status: STATUS.MISSING }
    }
  }
}

module.exports = Object.assign(DB, { STATUS })