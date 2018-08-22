const nodemailer = require('nodemailer');
const { isEmpty } = require('lodash')

class Mailer {

  constructor(sender, reply_to) {
    if (isEmpty(process.env.SMTP_USER)) {
      throw('Missing smtp user in environment variable')
    }
    if (isEmpty(process.env.SMTP_USER)) {
      throw('Missing smtp password in environment variable')
    }
    
    this.sender = sender
    this.reply_to = reply_to
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER || 'email-smtp.us-east-1.amazonaws.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    })
  }

  
  async send_email(to, cc, html_body, text_body, subject) {
    if (isEmpty(to) ||
        isEmpty(subject) ||
        isEmpty(html_body) ||
        isEmpty(text_body)) {
      throw 'Missing parameters to send an email'
    }
    // setup email data with unicode symbols
    let mailOptions = {
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
