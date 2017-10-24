require('dotenv').config();

const Botkit = require('botkit');
const os = require('os');
const util = require('util');
const timers = require('timers');
const setTimeoutPromise = util.promisify(timers.setTimeout);

const transcript = require('./sample-transcript.json');

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


controller.hears(['QA'], 'direct_message,direct_mention,mention', function(bot, message) {
  // bot.reply(message, 'Hello ' + user.name + '!!');
  var reply_with_attachments = {
    'username': 'My bot' ,
    'text': 'Q/A pair found for XXXX',
    'attachments': [
      {
        'fallback': 'What did Napoleon conquer Ottoman-ruled Egypt in in 1798? >>> In 1798, Napoleon conquered Ottoman-ruled Egypt in an attempt to strike at British trade routes with India. in an attempt to strike at British trade routes with India ',
        'title': 'What did Napoleon conquer Ottoman-ruled Egypt in in 1798?',
        'text': 'In 1798, Napoleon conquered Ottoman-ruled Egypt in an attempt to strike at British trade routes with India. in an attempt to strike at British trade routes with India ',
        'color': '#7CD197'
      }
    ],
    'icon_url': 'http://lorempixel.com/48/48'
    }

  bot.reply(message, reply_with_attachments);
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
