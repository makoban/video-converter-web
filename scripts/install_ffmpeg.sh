#!/bin/bash

# FFmpegがインストールされているか確認
if command -v ffmpeg &> /dev/null; then
    echo "FFmpeg is already installed"
    exit 0
fi

# FFmpegとFFprobeのインストール
apt-get update -qq && apt-get -y install ffmpeg

# インストール確認
ffmpeg -version
