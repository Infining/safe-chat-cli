'use strict';

const safe = require('safeclient')
const fs = require('fs')
const readline = require('readline')
const messagePath = '/'

let conf = {}
let alias
let rl = readline.createInterface(process.stdin, process.stdout)
let sTime = Date.now().toString()
let seenFiles = []

try {conf = safe.unmarshalConf(fs.readFileSync('./conf','utf8'))} catch (e) {
  if (e.code === 'ENOENT') {
    conf = null
  }
}

const client = new safe.Client(conf)

// Uncomment this to see debug info
//client.logger = console.log

// Authenticate with launcher
let p = safe.ensureAuthed(client, {
  app: {
    name: "SAFE Chat CLI",
    id: "infining.safe-chat-cli.safe",
    version: "0.0.1",
    vendor: "infining"
  }
})

// Save configuration file if first run
p = p.then(() => {
  if (conf === null) fs.writeFileSync('./conf',safe.marshalConf(client.conf))
})

// Create user alias
p = p.then(() => {
  rl.question("Enter your desired alias: ",(name) => {
    alias = name
    console.log('Your alias is now: ', alias)
    rl.prompt(true)
  })
  // Repeatedly scan the directory for new messages
  repeat(safeDirScan)
})

// Repeating helper function
function repeat(func) {
  func()
    .then(() => {
      repeat(func)
    })
}

// This is a 'fuck ugly' function to scan the directory for new files and read them out
function safeDirScan() {
  let newFiles = []
  return safe.nfs.getDir(client, {
    dirPath: messagePath
  })
  .then((dir) => {
    newFiles = dir.files.filter((file) => ((file.createdOn >= sTime) && (seenFiles.indexOf(file.name) === -1)))
    newFiles.forEach((file) => {
      seenFiles.push(file.name)
      safe.nfs.getFile(client, {filePath: messagePath+file.name}).then((fileBuf) => {console_out('(<'+JSON.parse(fileBuf).alias+'>): '+JSON.parse(fileBuf).message)})
    })
  }).catch(console_out)
}

// Send message to safe
rl.on('line', (message) => {
    let time = Date.now().toString()
    let file = alias+'_'+time
    safe.nfs.createFile(client, {
      filePath: file, // filename is time of message sent
    })
    .then(() => {
      safe.nfs.writeFile(client, {
        filePath: messagePath+file,
        contents: JSON.stringify({'alias':alias,'time':time,'message':message}) // contents are alias, time, and message
      })
    })
    rl.prompt(true)
})

// readline console.out fixes
function console_out(msg) {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    console.log(msg)
    rl.prompt(true)
}
