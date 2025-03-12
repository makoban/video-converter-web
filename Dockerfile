FROM node:18-slim

# 作業ディレクトリの設定
WORKDIR /app

# 依存関係のコピーとインストール
COPY package*.json ./

# スクリプトフォルダをコピー（重要: npm installの前に追加）
COPY scripts/ ./scripts/

# FFmpegのインストール（直接Dockerfileに記述）
RUN apt-get update && apt-get install -y ffmpeg

# 依存関係のインストール
RUN npm install

# アプリケーションファイルのコピー
COPY . .

# ポートの公開
EXPOSE 3000

# アプリケーションの起動
CMD ["npm", "start"]
