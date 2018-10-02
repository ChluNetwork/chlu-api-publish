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
          type: Sequelize.STRING
        },
        type: {
          type: Sequelize.STRING
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

  async createJob(did, type, status = null, data = null) {
    await this.Job.create({
      did,
      type,
      status: status || STATUS.CREATED,
      data
    })
    return did
  }

  async updateJob(did, type, data = null, status = null) {
    const job = await this.Job.findOne({
      where: { did, type }
    })
    const payload = {}
    if (data) {
      const existingData = job.toJSON().data
      const updatedData = existingData ? Object.assign(existingData, data) : data
      payload.data = updatedData
    }
    if (status) payload.status = status
    if (payload) await job.update(payload)
    return job
  }

  async setJobError(did, type, error) {
    // TODO: logging
    try {
      const job = await this.Job.findOne({
        where: { did, type }
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

  async getJob(did, type, other = {}) {
    const job = await this.Job.findOne({
      where: Object.assign({ did, type }, other)
    })
    if (job) {
      return job.toJSON()
    } else {
      return { status: STATUS.MISSING }
    }
  }

  async getJobs(did, limit = 0, offset = 0) {
    const result = await this.Job.findAndCountAll({
      where: { did },
      limit: limit > 0 ? limit : undefined,
      offset: offset > 0 ? offset : undefined
    })
    const jobs = result.rows.map(r => r.toJSON())
    return {
      rows: jobs,
      count: result.count
    }
  }
}

module.exports = Object.assign(DB, { STATUS })