require('dotenv').config();

const Botkit = require('botkit');
const os = require('os');
const util = require('util');
const timers = require('timers');
const setTimeoutPromise = util.promisify(timers.setTimeout);
const axios = require('axios');
const request = require('request');

const transcript = require('./sample-transcript.json');
const qa = require('./question_verification_sample.json');

var helpMessage = `
TRANSCRIBE - transcribe last uploaded media
PLAY - play transcript at reading speed
PAUSE - pauses playing
STOP - stop playing
GOTO p / GO TO p / GO p - jump to paragraph number p, example: GOTO 5
SHOW ALL QUESTIONS /SHOW ALLQ - show interviewer questions
SHOW ALL ANSWERS  / SHOW ALLA - show inteviewee replies
SUMMARY - show summary of interviewee replies
DOWNLOAD - Generates a plain text file that you can download

Note that you can also type these comands lowercase
  `

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

const controller = Botkit.slackbot({
    debug: true,
});

const bot = controller.spawn({
    token: process.env.token
}).startRTM();


var currentPara = 0;
var playing = false;
var playTimeout = null;

function play() {
  playing = true;

  if (currentPara > transcript.length - 1) {
    currentPara = 0;
    playing = false;
    bot.say('END OF TRANSCRIPT');
    timers.clearTimeout(playTimeout);
    return;
  }

  console.log('P ', currentPara);

  bot.say(getParagraphAsMessage(currentPara), function() {
    var d = 100;
    if (currentPara < transcript.length - 1 && getParagraphAsMessage(currentPara).text) {
      d = getParagraphAsMessage(currentPara).text.split(' ').length * 10;
    }

    currentPara++;

    timers.clearTimeout(playTimeout);
    if (playing) {
      playTimeout = setTimeoutPromise(d).then(function () {
        if (playing) play();
      });
    }
  });
}

function getParagraphAsMessage(index) {
  if (!transcript[index].speaker) transcript[index].speaker = 'Unknown';

  var text = '';

  if (transcript[index].words.length > 1) {
    text = transcript[index].words.reduce(function(acc, val) {
      if (typeof acc === 'object') acc = acc.text;
      return acc + ' ' + val.text;
    }) //+ ` _${index}_`
  } else {
    text = transcript[index].words[0].text;
  }

  return {
    channel: 'bbcnewshack17',
    icon_emoji: (transcript[index].speaker === 'Interviewer' ? ':sleuth_or_spy:' : ':speaking_head_in_silhouette:'),
    username: transcript[index].speaker  + ' ' + index + '/' + (transcript.length - 1),
    text: text.replace(/\. /g,'.\n\n')
  };
}

function getQAasMessage(index) {
  // "speaker": "interviewee",
  // "paragraphId": 1,
  // "question":"What do I 'm coming to speak at open source to?",
  // "answer": "Well I 'm coming to speak at open source open society to talk to people about how we can apply the concepts of the open source movement to larger parts of society.",
  // "confidence": 1.2249347799141348

  const {speaker, paragraphId, question, answer, confidence} = qa[index];

  return {
    channel: 'bbcnewshack17',
    '_username': speaker + ` ${index}/${qa.length}` ,
    'text': '',
    'attachments': [
      {
        'fallback': `${question}: ${answer}`,
        'title': question,
        'text': answer,
        'color': '#7CD197'
      }
    ],
    // icon_emoji: (speaker === 'interviewer' ? ':sleuth_or_spy:' : ':speaking_head_in_silhouette:'),
    // 'icon_url': 'http://lorempixel.com/48/48'
  };
}

function getQAasMessage2(index) {
  // "speaker": "interviewee",
  // "paragraphId": 1,
  // "question":"What do I 'm coming to speak at open source to?",
  // "answer": "Well I 'm coming to speak at open source open society to talk to people about how we can apply the concepts of the open source movement to larger parts of society.",
  // "confidence": 1.2249347799141348

  const {speaker, paragraphId, question, answer, confidence} = qa[index];

  return {
    channel: 'bbcnewshack17',
    '_username': speaker + ` ${index}/${qa.length}` ,
    'text': '',
    'attachments': [
      {
        'fallback': `${question}: ${answer}`,
        'title': '',
        'text': `${paragraphId} - ${answer}`,
        'color': '#7CD197'
      }
    ],
    // icon_emoji: (speaker === 'interviewer' ? ':sleuth_or_spy:' : ':speaking_head_in_silhouette:'),
    // 'icon_url': 'http://lorempixel.com/48/48'
  };
}


function gotoNextQ() {
  if (currentPara > transcript.length - 1) {
    currentPara = 0;
    playing = false;
    return;
  }

  if (getParagraphAsMessage(currentPara).username.startsWith('Interviewer')) {
    bot.say(getParagraphAsMessage(currentPara), function() {
      currentPara++;
      gotoNextQ();
    });
  } else {
    currentPara++;
    gotoNextQ();
  }
}

function gotoNextA() {
  if (currentPara > transcript.length - 1) {
    currentPara = 0;
    playing = false;
    return;
  }

  if (!getParagraphAsMessage(currentPara).username.startsWith('Interviewer')) {
    bot.say(getParagraphAsMessage(currentPara), function() {
      currentPara++;
      gotoNextA();
    });
  } else {
    currentPara++;
    gotoNextA();
  }
}

let currentQ = 0;

function qaNextQ() {
  if (currentQ > qa.length - 1) {
    currentQ = 0;
    return;
  }

  if (getQAasMessage2(currentQ)._username.startsWith('interviewee')) {
    bot.say(getQAasMessage2(currentQ), function() {
      currentQ++;
      qaNextQ();
    });
  } else {
    currentQ++;
    qaNextQ();
  }
}

controller.hears(['PLAY'], 'direct_message,direct_mention,mention', function(bot, message) {
  play();
});

controller.hears(['PAUSE'], 'direct_message,direct_mention,mention', function(bot, message) {
  playing = false;
  timers.clearTimeout(playTimeout);
  bot.reply(message, 'PAUSED at ' + currentPara);
});

controller.hears([ 'STOP'], 'direct_message,direct_mention,mention', function(bot, message) {
  playing = false;
  timers.clearTimeout(playTimeout);
  bot.reply(message, 'STOPPED at ' + currentPara+' Rewinding to beginning of transcription');
  currentPara = 0;
});


controller.hears(['GOTO (.*)', 'GO TO (.*)','GO (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
  var para = parseInt(message.match[1]);
  timers.clearTimeout(playTimeout);
  currentPara = para;
  bot.reply(message, 'GOTO at ' + currentPara);
  if (!playing) {
    bot.reply(message, getParagraphAsMessage(currentPara));
  }
});

controller.hears(['SHOW ALL QUESTIONS', 'ALLQ'], 'direct_message,direct_mention,mention', function(bot, message) {
  currentPara = 0;
  playing = false;
  gotoNextQ();
});

controller.hears(['SUMMARY'], 'direct_message,direct_mention,mention', function(bot, message) {
  currentQ = 0;
  qaNextQ();
});

controller.hears(['TRANSCRIBE'], 'direct_message,direct_mention,mention', function(bot, message) {
  bot.reply(message, 'transcribing... Your transcription will be ready in 3 minutes.', () => {
    playing = false;
    currentPara = 0;
    setTimeoutPromise(3000).then(() => {
      bot.say({
        channel: 'bbcnewshack17',
        text: 'Transcribed, to play the transcript use @bot PLAY, for more options use @bot HELP'
      });
    });
  });
});


controller.hears(['SHOW ALL ANSWERS', 'ALLA'], 'direct_message,direct_mention,mention', function(bot, message) {
  currentPara = 0;
  playing = false;
  gotoNextA();
});

controller.hears(['HELP'], 'direct_message,direct_mention,mention', function(bot, message) {
  bot.reply(message, helpMessage);
});

function getTranscriptText() {
    const t = [];
    for(let i = 0; i < transcript.length; i++) {
      const {text, username} = getParagraphAsMessage(i);
      t.push(`\n${username} ${text}`);
    }
    return t.join('\n');
}

controller.hears(['DOWNLOAD'], 'direct_message,direct_mention,mention', function(bot, message) {
  request.post('https://slack.com/api/files.upload').form({
        token: process.env.stoken,
        channels: 'bbcnewshack17',
        content: getTranscriptText(),
        filename: 'transcript.txt'
  }, function(err, httpResponse, body){
    console.log(err, body);
  });
});


controller.on('user_typing', function(bot, message) {
  if (! playing) return;
  playing = false;
  timers.clearTimeout(playTimeout);
  bot.say({
    channel: 'bbcnewshack17',
    text: 'Paused due to user typing, resume with @bot PLAY',
  });
});

controller.on('file_shared', function(bot, message) {
    console.log(message);
    bot.say({
      channel: 'bbcnewshack17',
      text: `If you want me to transcribe this file, use @bot TRANSCRIBE, for more options use @bot HELP ${helpMessage}`,
    });
});



controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
