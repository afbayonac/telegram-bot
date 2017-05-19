const TelegramBot = require('node-telegram-bot-api')
const mongoose = require('mongoose')
const cfg = require('./secret')
const express = require('express')
const bodyParser = require('body-parser')

// replace the value below with the Telegram token you receive from @BotFather
const token = cfg.token
const url = cfg.url

// Create a bot

const bot = new TelegramBot(token)
bot.setWebHook(`${url}/bot${token}`)

// config express

const app = express()
app.use(bodyParser.json())

// connect data base
mongoose.connect('mongodb://localhost:27017/ejemplo_pi')
    .then(() => console.log('ok'), (err) => console.log(err))

// create Model
var parkSchema = new mongoose.Schema({
  geometry: {
    type: {type: String, default: 'Point'},
    coordinates: {type: [Number], index: '2dsphere'}
  },
  address: String,
  name: String
})

const Park = mongoose.model('parks', parkSchema)

app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body)
  res.sendStatus(200)
})

app.listen(4000, () => {
  console.log(`Express server is listening on 4000`)
})

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id
  const resp = match[1] // the captured "whatever"

  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, resp)
})

// parks
bot.onText(/^\/parks(.*)/, (msg, match) => {
  const resp =
`
Para poder encontrar el parque mas cercano necesito tu localizacion
`
  var opts = {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
      force_reply: true,
      keyboard: [
        [{text: 'Mi localización', request_location: true}],
        [{text: 'No Gracias'}]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  )}
  bot.sendMessage(msg.chat.id, resp, opts)
    .then(
      bot.once('location', sendPark)
    )
})

function sendPark (msg) {
  console.log(msg.location.longitude, msg.location.latitude)
  Park.find({
    'geometry.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [msg.location.longitude, msg.location.latitude]
        },
        $maxDistance: 100000, // en metros
        $minDistance: 0
      }
    }
  })
  .limit(1)
  .exec((err, park) => {
    if (err) { console.log(err) }
    var opts = {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: JSON.stringify({
        remove_keyboard: true
      }
    )}
    console.log(park)
    if (park.length === 0) {
      return bot.sendMessage(msg.chat.id, 'no encuentro parques cerca', opts)
    }
    let lat = park[0].geometry.coordinates[1]
    let lng = park[0].geometry.coordinates[0]
    bot.sendVenue(msg.chat.id, lat, lng, park[0].name, park[0].address, opts)
  })
}
