// Copyright 2010 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)

#include <stdio.h>
#include <stdlib.h>

#include "earcon_manager.h"
#include "log.h"
#include "resampler.h"
#include "tts_receiver.h"

namespace tts_service {

struct WavFormatChunk {
  uint16_t format;
  uint16_t channels;
  uint32_t samplerate;
  uint32_t byterate;
  uint16_t block_align;
  uint16_t bits_per_sample;
};

// This is just for clarity; WAV files use a sequence of four
// meaningful characters to mark different sections of the file.
// We read and write them as single 32-bit values.
inline const uint32_t FourCharUInt32(const char *str) {
  return *reinterpret_cast<const uint32_t *>(str);
}

class EarconReceiver : public TtsDataReceiver {
 public:
  explicit EarconReceiver(Earcon* earcon) : earcon_(earcon) {}

  virtual tts_callback_status Receive(int rate,
                                      int num_channels,
                                      const int16_t* data,
                                      int num_samples) {
    int count = num_samples;
    if (count > earcon_->frame_count - earcon_->position)
      count = earcon_->frame_count - earcon_->position;

    for (int i = 0; i < count * num_channels; i++)
      earcon_->data[num_channels * earcon_->position + i] = data[i];

    earcon_->position += num_samples;
    if (earcon_->position == earcon_->frame_count)
      return TTS_CALLBACK_HALT;
    else
      return TTS_CALLBACK_CONTINUE;
  }

  virtual tts_callback_status Done() {
    return TTS_CALLBACK_HALT;
  }

 private:
  Earcon* earcon_;
};

EarconManager::EarconManager(int output_frame_rate, int output_channels)
    : rate_(output_frame_rate), channels_(output_channels) {
}

EarconManager::~EarconManager() {
  for (unsigned int i = 0; i < earcons_.size(); i++) {
    delete[] earcons_[i].data;
  }
}

int EarconManager::LoadEarcon(int frame_count,
                              int16_t* data,
                              int source_channels,
                              int source_rate,
                              bool loop) {
  int earcon_id = earcons_.size();
  earcons_.push_back(Earcon());
  int16_t* new_data = new int16_t[frame_count * channels_];

  // Convert from the source channels to the destination number of
  // channels.
  if (source_channels == 1 && channels_ == 2) {
    for (int i = 0; i < frame_count; i++) {
      new_data[2 * i] = data[i];
      new_data[2 * i + 1] = data[i];
    }
  } else if (source_channels == 2 && channels_ == 1) {
    for (int i = 0; i < frame_count; i++)
      new_data[i] = (data[2 * i] + data[2 * i + 1]) / 2;
  } else if (source_channels == channels_) {
    for (int i = 0; i < frame_count * channels_; i++)
      new_data[i] = data[i];
  } else {
    LOG(ERROR) << "Fatal: unsupported number of channels";
    exit(0);
  }

  // Initialize the earcon. If the sample rate is unchanged, we're done.
  Earcon* earcon = &earcons_.back();
  earcon->is_playing = false;
  earcon->position = 0;
  earcon->loop = loop;
  if (source_rate == rate_) {
    earcon->frame_count = frame_count;
    earcon->data = new_data;
    return earcon_id;
  }

  // Resample if needed.
  int new_size = frame_count * rate_ / source_rate;
  earcon->frame_count = new_size;
  earcon->data = new int16_t[new_size * channels_];
  EarconReceiver receiver(earcon);
  Resampler resampler(&receiver, source_rate, rate_, new_size);
  resampler.Receive(source_rate, channels_, data, frame_count);
  resampler.Done();
  earcon->frame_count = earcon->position;
  earcon->position = 0;
  delete[] new_data;
  return earcon_id;
}

int EarconManager::LoadEarconFromWavFile(const char *path, bool loop) {
  FILE* fp = fopen(path, "rb");
  if (!fp || ferror(fp)) {
    return -1;
  }
  fseek(fp, 0, SEEK_END);
  unsigned int filelen = static_cast<unsigned int>(ftell(fp));
  if (filelen < 40) {
    LOG(ERROR) << "File too short to be a WAV file.";
    return -1;
  }
  fseek(fp, 0, SEEK_SET);
  char* data = new char[filelen];
  if (filelen != fread(data, 1, filelen, fp)) {
    LOG(ERROR) << "Error reading file.";
    delete[] data;
    return -1;
  }

  if (reinterpret_cast<uint32_t*>(data)[0] != FourCharUInt32("RIFF") ||
      reinterpret_cast<uint32_t*>(data)[2] != FourCharUInt32("WAVE")) {
    LOG(ERROR) << "File is not WAV format.";
    delete[] data;
    return -1;
  }

  int channels = 0;
  int rate = 0;
  int bitrate = 0;
  int frames = 0;
  int16_t* audio_data = new int16_t[1];

  int pos = 12;
  while (filelen - pos >= 8) {
    uint32_t label = reinterpret_cast<uint32_t*>(&data[pos])[0];
    uint32_t chunk_bytes = reinterpret_cast<uint32_t*>(&data[pos])[1];
    if (filelen - pos < chunk_bytes)
      goto err;
    if (label == FourCharUInt32("fmt ")) {
      if (chunk_bytes < sizeof(WavFormatChunk))
        goto err;
      if (chunk_bytes > 1024)
        goto err;
      WavFormatChunk* format =
          reinterpret_cast<WavFormatChunk*>(&data[pos + 8]);
      if (format->format != 1)
        goto err;
      if (format->channels < 1 || format->channels > 2)
        goto err;
      if (format->bits_per_sample != 16)
        goto err;
      unsigned int expected_byterate =
          format->samplerate * format->channels *
          format->bits_per_sample / 8;
      if (format->byterate != expected_byterate)
        goto err;
      if (format->block_align !=
          format->channels * format->bits_per_sample / 8)
        goto err;
      rate = format->samplerate;
      channels = format->channels;
      bitrate = format->byterate + 8;
    } else if (label == FourCharUInt32("data")) {
      if (rate == 0 || channels == 0)
        goto err;
      int new_frames = chunk_bytes / (2 * channels);
      int16_t* new_audio_data = reinterpret_cast<int16_t*>(&data[pos + 8]);
      int16_t* old_audio_data = audio_data;
      audio_data = new int16_t[(frames + new_frames) * channels];
      for (int i = 0; i < frames * channels; i++)
        audio_data[i] = old_audio_data[i];
      for (int i = 0; i < new_frames * channels; i++)
        audio_data[i + frames * channels] = new_audio_data[i];
      delete[] old_audio_data;
      frames += new_frames;
    }

    pos += chunk_bytes + 8;
  }

  if (frames && channels && rate) {
    int earcon_id = LoadEarcon(frames, audio_data, channels, rate, loop);
    delete[] data;
    delete[] audio_data;
    return earcon_id;
  }

 err:
  LOG(ERROR) << "Error reading WAV file";
  delete[] data;
  delete[] audio_data;
  return -1;
}

void EarconManager::Play(int earcon_id) {
  earcons_[earcon_id].is_playing = true;
  earcons_[earcon_id].position = 0;
}

void EarconManager::Stop(int earcon_id) {
  earcons_[earcon_id].is_playing = false;
}

void EarconManager::StopAll() {
  for (unsigned int i = 0; i < earcons_.size(); i++)
    earcons_[i].is_playing = false;
}

bool EarconManager::IsPlaying(int earcon_id) {
  return earcons_[earcon_id].is_playing;
}

bool EarconManager::IsAnythingPlaying() {
  for (unsigned int i = 0; i < earcons_.size(); i++) {
    if (earcons_[i].is_playing)
      return true;
  }
  return false;
}

void EarconManager::FillAudioBuffer(int16_t* data,
                                    int frame_count,
                                    int channel_count) {
  if (channel_count != channels_) {
    LOG(ERROR) << "Fatal: EarconManager was initialized with "
               << channels_ << " channels, but FillAudioBuffer is requesting "
               << channel_count << " channels.";
    exit(-1);
  }

  for (unsigned int i = 0; i < earcons_.size(); i++) {
    // Skip earcons that aren't playing now.
    if (!earcons_[i].is_playing)
      continue;

    // Figure out how many frames of this earcon to play.
    int count = frame_count;
    if (count > earcons_[i].frame_count - earcons_[i].position)
      count = earcons_[i].frame_count - earcons_[i].position;

    // Mix in this earcon with the existing audio, and handle
    // clipping properly.
    int16_t* earcon_data = &earcons_[i].data[
        channels_ * earcons_[i].position];
    for (int j = 0; j < count * channels_; j++) {
      int value = data[j] + earcon_data[j];
      if (value > 32767)
        value = 32767;
      if (value < -32768)
        value = -32768;
      data[j] = value;
    }

    earcons_[i].position += count;
    if (earcons_[i].position == earcons_[i].frame_count)
      earcons_[i].is_playing = false;
  }
}

}  // namespace tts_service

