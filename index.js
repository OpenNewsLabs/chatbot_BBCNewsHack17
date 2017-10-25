require('dotenv').config();

const Botkit = require('botkit');
const os = require('os');
const util = require('util');
const timers = require('timers');
const setTimeoutPromise = util.promisify(timers.setTimeout);
const axios = require('axios');

const transcript = require('./sample-transcript.json');
const qa = require('./question_verification_sample.json');

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
    text: text
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
    // 'username': speaker + ` ${index}/${qa.length}` ,
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
    // 'username': speaker + ` ${index}/${qa.length}` ,
    'text': '',
    'attachments': [
      {
        'fallback': `${question}: ${answer}`,
        'title': '',
        'text': answer,
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

  // if (getQAasMessage(currentQ).username.startsWith('interviewer')) {
    bot.say(getQAasMessage2(currentQ), function() {
      currentQ++;
      qaNextQ();
    });
  // } else {
  //   currentQ++;
  //   qaNextQ();
  // }
}

controller.hears(['PLAY'], 'direct_message,direct_mention,mention', function(bot, message) {
  play();
});

controller.hears(['PAUSE', 'STOP'], 'direct_message,direct_mention,mention', function(bot, message) {
  playing = false;
  timers.clearTimeout(playTimeout);
  bot.reply(message, 'PAUSED at ' + currentPara);
});

controller.hears(['GOTO (.*)', 'GO TO (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
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
  bot.reply(message, 'transcribing...', () => {
    playing = false;
    currentPara = 0;
    bot.say({
      channel: 'bbcnewshack17',
      text: 'Transcribed, to play the transcript use @bot PLAY, for more options use @bot HELP'
    });
  });
});


controller.hears(['SHOW ALL ANSWERS', 'ALLA'], 'direct_message,direct_mention,mention', function(bot, message) {
  currentPara = 0;
  playing = false;
  gotoNextA();
});

controller.hears(['HELP'], 'direct_message,direct_mention,mention', function(bot, message) {
  bot.reply(message, `
TRANSCRIBE - transcribe last uploaded media
PLAY - play transcript at reading speed
PAUSE / STOP - stop playing
GOTO p / GO TO p - jump to paragraph number p, example: GOTO 5
SHOW ALL QUESTIONS - show interviewer questions
SHOW ALL ANSWERS - show inteviewee replies
SUMMARY - show summary of interviewee replies
  `);
});

controller.hears(['DOWNLOAD'], 'direct_message,direct_mention,mention', function(bot, message) {
  axios.post('https://slack.com/api/files.upload', {
      token: process.env.stoken,
      channels: 'bbcnewshack17',
      content: 'zee transcript',
      filename: 'transcript.txt'
    }, {
      headers: {
      'Content-type': 'application/x-www-form-urlencoded'
      }
    })
    .then(function (response) {
      console.log(response);
    })
    .catch(function (error) {
      console.log(error);
    });
});

// controller.hears(['QA'], 'direct_message,direct_mention,mention', function(bot, message) {
//   // bot.reply(message, 'Hello ' + user.name + '!!');
//   var reply_with_attachments = {
//     'username': 'My bot' ,
//     'text': 'Q/A pair found for XXXX',
//     'attachments': [
//       {
//         'fallback': 'What did Napoleon conquer Ottoman-ruled Egypt in in 1798? >>> In 1798, Napoleon conquered Ottoman-ruled Egypt in an attempt to strike at British trade routes with India. in an attempt to strike at British trade routes with India ',
//         'title': 'What did Napoleon conquer Ottoman-ruled Egypt in in 1798?',
//         'text': 'In 1798, Napoleon conquered Ottoman-ruled Egypt in an attempt to strike at British trade routes with India. in an attempt to strike at British trade routes with India ',
//         'color': '#7CD197'
//       }
//     ],
//     'icon_url': 'http://lorempixel.com/48/48'
//     }
//
//     bot.reply(message, reply_with_attachments);
//     // bot.say(reply_with_attachments);
// });

// let typing = null;
// let wasPlaying = false;

controller.on('user_typing', function(bot, message) {
  if (! playing) return;
  playing = false;
  timers.clearTimeout(playTimeout);
  bot.say({
    channel: 'bbcnewshack17',
    text: 'Paused due to user typing, resume with @bot PLAY',
  });
  // timers.clearTimeout(typing);
  //
  // typing = setTimeoutPromise(1000).then(() => {
  //   timers.clearTimeout(typing);
  //   // playing = true;
  //   play();
  // });



});

controller.on('file_shared', function(bot, message) {
    console.log(message);
    bot.say({
      channel: 'bbcnewshack17',
      text: 'If you want me to transcribe this file, use @bot TRANSCRIBE, for more options use @bot HELP',
    });
    // message.type = 'message';
    // message.channel = 'bbcnewshack17';
    // bot.startConversation(
    //   message,
    //   // {
    //   // user: message.user_id,
    //   // channel: message.user_id, //'bbcnewshack17',
    //   // text: 'dummy'
    //   // } ,
    //   function(err, convo) {
    //
    //     convo.ask('Do you want me to transcribe this media file?', [
    //         {
    //             pattern: bot.utterances.yes,
    //             callback: function(response, convo) {
    //                 convo.say('Transcribing...');
    //                 convo.next();
    //             }
    //         },
    //     {
    //         pattern: bot.utterances.no,
    //         default: true,
    //         callback: function(response, convo) {
    //             convo.say('*Phew!*');
    //             convo.next();
    //         }
    //     }
    //     ]);
    // });
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
