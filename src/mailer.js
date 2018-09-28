const nodemailer = require('nodemailer');
const { isEmpty } = require('lodash')

class Mailer {

  constructor(config = {}) {
    this.sender = config.sender
    this.reply_to = config.replyTo
    this.host = config.host
    this.port = config.port
    this.secure = config.secure
    this.smtpUser = config.smtpUser
    this.smtpPassword = config.smtpPassword
  }

  async start() {
    if (this.host) {
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port:  this.port,
        secure: this.secure,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPassword
        }
      })
    }
  }
  
  async send_email(to, cc, html_body, text_body, subject) {
    if (!this.transporter) return false
    if (isEmpty(to) ||
        isEmpty(subject) ||
        isEmpty(html_body) ||
        isEmpty(text_body)) {
      throw 'Missing parameters to send an email'
    }
    // setup email data with unicode symbols
    const mailOptions = {
      from: this.sender,
      to: to,
      subject: subject,
      text: text_body,
      html: html_body
    }
    console.log(mailOptions)
    try {
      let result = await this.transporter.sendMail(mailOptions)
      console.log('result...')
      console.log(result)
    } catch(error) {
      console.log(`SENDING EMAIL => ERROR ${error.message}`)
      return false
    }
    return true
  }
}

module.exports = Mailer
