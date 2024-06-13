require('dotenv').config();
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');
const { Deepgram } = require('@deepgram/sdk');
const ffmpegStatic = require('ffmpeg-static');
const ytdl = require('ytdl-core');
const deepgram = new Deepgram(process.env.DG_KEY);

// Uncomment one of these
transcribeLocalVideo('deepgram.mp4');
// transcribeRemoteVideo('https://rawcdn.githack.com/deepgram-devs/transcribe-videos/62fc7769d6e2bf38e420ee5224060922af4546f7/deepgram.mp4');
// transcribeYouTubeVideo('https://www.youtube.com/watch?v=JhU0yO43b6o').catch(console.error);

async function transcribeYouTubeVideo(youtubeUrl) {
    try {
        const videoInfo = await ytdl.getInfo(youtubeUrl);
        const videoTitle = videoInfo.videoDetails.title.replace(/[\/\\?%*:|"<>]/g, '-');
        const videoId = videoInfo.videoDetails.videoId;
        const fileName = `${videoTitle}-${videoId}.mp4`;
        const wavFileName = `${videoTitle}-${videoId}.wav`;
        
        console.log(`Starting download for ${videoTitle}`);
        await new Promise((resolve, reject) => {
            ytdl(youtubeUrl, { filter: 'audioonly' })
                .pipe(fs.createWriteStream(fileName))
                .on('finish', () => {
                    console.log(`Downloaded video to ${fileName}`);
                    resolve();
                })
                .on('error', (error) => {
                    console.error(`Error downloading video: ${error.message}`);
                    reject(error);
                });
        });

        console.log(`Converting ${fileName} to WAV format`);
        await ffmpeg(`-hide_banner -y -i "${fileName}" "${wavFileName}"`);
        
        if (!fs.existsSync(wavFileName)) {
            throw new Error(`WAV file not found after conversion: ${wavFileName}`);
        }
        
        const audioFile = { buffer: fs.readFileSync(wavFileName), mimetype: 'audio/wav' };
        console.log(`Sending audio file to Deepgram for transcription`);
        const response = await deepgram.transcription.preRecorded(audioFile, { punctuation: true });
        console.log('Deepgram response received:', response);

        const transcriptionResult = response.results;
        if (!transcriptionResult) {
            throw new Error('Transcription result is undefined');
        }

        // Write transcription results to a JSON file
        fs.writeFileSync(`${fileName}.json`, JSON.stringify(transcriptionResult, null, 2));
        console.log(`Transcription saved to ${fileName}.json`);

        return transcriptionResult;
    } catch (error) {
        console.error(`Error in transcribeYouTubeVideo: ${error.message}`);
        console.error(error.stack);
    }
}

async function transcribeLocalVideo(filePath) {
    try {
        console.log(`Starting transcription for ${filePath}`);
        await ffmpeg(`-hide_banner -y -i ${filePath} ${filePath}.wav`);
        
        const wavFilePath = `${filePath}.wav`;
        if (!fs.existsSync(wavFilePath)) {
            throw new Error(`File not found: ${wavFilePath}`);
        }
        
        const audioFile = { buffer: fs.readFileSync(wavFilePath), mimetype: 'audio/wav' };
        console.log(`Sending audio file to Deepgram for transcription`);
        const response = await deepgram.transcription.preRecorded(audioFile, { punctuation: true });
        console.log('Deepgram response received:', response);

        const transcriptionResult = response.results;
        if (!transcriptionResult) {
            throw new Error('Transcription result is undefined');
        }

        // Write transcription results to a JSON file
        fs.writeFileSync(`${filePath}.json`, JSON.stringify(transcriptionResult, null, 2));
        console.log(`Transcription saved to ${filePath}.json`);

        return transcriptionResult;
    } catch (error) {
        console.error(`Error in transcribeLocalVideo: ${error.message}`);
    }
}

async function ffmpeg(command) {
    return new Promise((resolve, reject) => {
        exec(`"${ffmpegStatic}" ${command}`, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error executing ffmpeg command: ${stderr}`);
                reject(`Error executing ffmpeg command: ${stderr}`);
            } else {
                resolve(stdout);
            }
        });
    });
}

