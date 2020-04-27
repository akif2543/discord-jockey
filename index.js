require("dotenv").config();
const Discord = require('discord.js');
const ytdl = require('ytdl-core-discord')

const client = new Discord.Client();
client.login(process.env.DISCORD_TOKEN);

const prefix = "!";
const queue = new Map();
let dispatcher;

client.once('ready', ()=>{
    console.log('Ready!');
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnected!");
});

client.on('message', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}queue`)) {
        list(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}pause`)) {
        pause(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}resume`)) {
        resume(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}clear`)) {
        clear(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}track`)) {
        track(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}help`)) {
        help(message);
    };
});

const execute = async (message, serverQueue) => {
    const args = message.content.split(' ');
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send("I don't have the permission to join and speak in your voice channel.")
    };
    if (!args[1]) {
      message.channel.send('You need to supply a Youtube url.');
      return;
    };

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.title,
        url: songInfo.video_url,
    };

    if (!serverQueue) {
        const queueContract = {
          textChannel: message.channel,
          voiceChannel: voiceChannel,
          connection: null,
          songs: [],
          volume: 5,
          playing: true,
        };
        queue.set(message.guild.id, queueContract);
        queueContract.songs.push(song);

        try {
          const connection = await voiceChannel.join();
          queueContract.connection = connection;
          play(message, queueContract.songs[0]);
        } catch (err) {
          console.log(err);
          queue.delete(message.guild.id);
          return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        console.log(serverQueue.songs);
        return message.channel.send(`${song.title} has been added to the queue!`);
    }
};

const skip = async (message, serverQueue) => {
    if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to stop the music!');
    if (!serverQueue) return message.channel.send('Nothing is currently playing.');
    try {
        await dispatcher.end();
    } catch(err) {
        console.log(err);
    };
};

const stop = async (message, serverQueue) => {
    if (!message.member.voice.channel)
      return message.channel.send(
        "You have to be in a voice channel to stop the music!"
      );
    serverQueue.songs = [];
    try {
      await dispatcher.end();
    } catch(err) {
      console.log(err);
    };
};

const play = async (message, song) => {
  const serverQueue = queue.get(message.guild.id);
  
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(message.guild.id);
    return;
  }

  try {
    dispatcher = serverQueue.connection.play(await ytdl(song.url), {
      type: "opus",
      volume: false,
      highWaterMark: 50,
    });
    dispatcher
      .on("start", () => {
        console.log("Music now playing.");
        message.channel.send(`Now playing ${song.title}.`);
      })
      .on("finish", () => {
        console.log("Music ended!");
        serverQueue.songs.shift();
        play(message, serverQueue.songs[0]);
      })
      .on("error", (err) => {
        console.error(err);
      });
  }catch(err) {
    console.log(err);
  };  
};

const list = (message, serverQueue) => {
  if (!serverQueue) return;
  let tracks = serverQueue.songs.map(song => {
    console.log(song)
    return song.title;
  });
  console.log(tracks);
  let next_tracks = tracks.slice(1).join(' , ');
  console.log(next_tracks);
  message.channel.send(`Queued tracks: ${next_tracks}`);
};

const pause = (message, serverQueue) => {
  if (!serverQueue) return;
  dispatcher.pause();
  message.channel.send(`Playback paused.`);
};

const resume = (message, serverQueue) => {
  if (!serverQueue) return;
  dispatcher.resume();
  message.channel.send(`Playback resumed.`);
};

const clear = (message, serverQueue) => {
  if (!serverQueue) return;
  serverQueue.songs = [];
  message.channel.send(`Queue cleared.`);
};

const track = (message, serverQueue) => {
  if (!serverQueue) return;
  message.channel.send(`The current track is ${serverQueue.songs[0].title}.`);
};

const help = (message) => {
  let commands =
    "Valid commands:\n!play {YouTubeUrl} to play a track or add a track to the queue\n!skip to skip the current track\n!pause to pause playback\n!resume to resume playback\n!track to list the current track\n!queue to see the current queue\n!clear to clear the queue\n!stop to end the session";
  message.channel.send(commands);
};