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
    this.logger = options.logger
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
        logging: this.logger || false,
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

  async stop() {
    await this.db.close()
  }

  async createJob(did, status = null, data = null) {
    await this.Job.create({
      did,
      status: status || STATUS.CREATED,
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

  async setJobError(did, error) {
    // TODO: logging
    try {
      const job = await this.Job.findOne({
        where: { did }
      })
      await job.update({
        status: STATUS.ERROR,
        data: { error: error.message || error }
      })
      return true
    } catch (error) {
      // Not found?
      return false
    }
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