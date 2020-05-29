require("dotenv").config();
const Discord = require("discord.js");
const ytdl = require("ytdl-core-discord");

const client = new Discord.Client();
client.login(process.env.DISCORD_TOKEN);

const prefix = "!";
const queue = new Map();
let dispatcher;

client.once("ready", () => {
  console.log("Ready!");
});

client.once("reconnecting", () => {
  console.log("Reconnecting!");
});

client.once("disconnect", () => {
  console.log("Disconnected!");
});

client.on("message", (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)) {
    return execute(message, serverQueue);
  }
  if (message.content.startsWith(`${prefix}skip`)) {
    return skip(message, serverQueue);
  }
  if (message.content.startsWith(`${prefix}stop`)) {
    return stop(message, serverQueue);
  }
  if (message.content.startsWith(`${prefix}queue`)) {
    return list(message, serverQueue);
  }
  if (message.content.startsWith(`${prefix}pause`)) {
    return pause(message, serverQueue);
  }
  if (message.content.startsWith(`${prefix}resume`)) {
    return resume(message, serverQueue);
  }
  if (message.content.startsWith(`${prefix}clear`)) {
    return clear(message, serverQueue);
  }
  if (message.content.startsWith(`${prefix}track`)) {
    return track(message, serverQueue);
  }
  if (message.content.startsWith(`${prefix}help`)) {
    return help(message);
  }
  if (message.content.startsWith(`${prefix}volume`)) {
    return volume(message);
  }
  if (message.content.startsWith(`${prefix}quit`)) {
    return quit(message, serverQueue);
  }
});

client.on("error", console.log);

process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});

const execute = async (message, serverQueue) => {
  const args = message.content.split(" ");
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I don't have the permission to join and speak in your voice channel."
    );
  }
  if (!args[1]) {
    return message.channel.send("You need to supply a Youtube url.");
  }

  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
    title: songInfo.title,
    url: songInfo.video_url,
  };

  if (!serverQueue) {
    const queueContract = {
      textChannel: message.channel,
      voiceChannel,
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
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  if (!serverQueue)
    return message.channel.send("Nothing is currently playing.");
  try {
    await dispatcher.end();
  } catch (err) {
    console.log(err);
  }
};

const stop = async (message, serverQueue) => {
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  serverQueue.songs = [];
  try {
    await dispatcher.end();
  } catch (err) {
    console.log(err);
  }
};

const play = async (message, song) => {
  const serverQueue = queue.get(message.guild.id);

  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(message.guild.id);
    return;
  }

  let stream;

  try {
    stream = await ytdl(song.url, { filter: "audioonly" });
  } catch (err) {
    console.error(err);

    serverQueue.songs.shift();
    if (serverQueue.songs.length) {
      message.channel.send(
        `Hmmm, I can't seem to play ${song.title}. Skipping.`
      );
      play(message, serverQueue.songs[0]);
    } else {
      message.channel.send(
        `Hmmm, I can't seem to play ${song.title}. No more songs in queue.`
      );
      return quit(message, serverQueue);
    }
  }

  dispatcher = serverQueue.connection.play(stream, {
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
};

const list = (message, serverQueue) => {
  if (!serverQueue) return;
  let tracks = serverQueue.songs.map((song) => {
    return song.title;
  });
  let next_tracks = tracks.slice(1).join(" , ");
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
  const commands =
    "Valid commands:\n!play {YouTubeUrl} to play a track or add a track to the queue\n!skip to skip the current track\n!pause to pause playback\n!resume to resume playback\n!track to list the current track\n!queue to see the current queue\n!clear to clear the queue\n!volume for details on how to adjust the volume\n!stop to end the session";
  message.channel.send(commands);
};

const volume = (message) => {
  message.channel.send(
    "You can adjust my volume by right clicking me in the voice channel and moving the user volume slider to your desired level."
  );
};

const quit = async (message, serverQueue) => {
  if (!serverQueue)
    return message.channel.send("Nothing is currently playing.");
  if (!message.member.voice.channel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  try {
    message.channel.send("Screw you guys, I'm going home.");
    await serverQueue.connection.disconnect();
    serverQueue.songs = [];
  } catch (err) {
    console.log(err);
  }
};
