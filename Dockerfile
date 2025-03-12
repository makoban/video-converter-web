FROM node:18-slim

# 作業ディレクトリの設定
WORKDIR /app

# 依存関係のコピーとインストール
COPY package*.json ./
RUN npm install

# FFmpegのインストール
RUN apt-get update && apt-get install -y ffmpeg

# アプリケーションファイルのコピー
COPY . .

# ポートの公開
EXPOSE 3000

# アプリケーションの起動
CMD ["npm", "start"]
