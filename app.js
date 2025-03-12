const express = require("express");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const morgan = require("morgan");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(
  fileUpload({
    createParentPath: true,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB制限
    },
    abortOnLimit: true,
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

// 静的ファイルの提供
app.use(express.static("public"));

// 処理済みファイルの保存ディレクトリ
const processedDir = path.join(__dirname, "processed");
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

// アップロードディレクトリ
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ファイルアップロードとプロセス処理のエンドポイント
app.post("/api/process-videos", async (req, res) => {
  try {
    // ファイルのチェック
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "ファイルがアップロードされていません",
      });
    }

    // 複数ファイルへの対応
    let videoFiles = [];
    if (Array.isArray(req.files.videos)) {
      videoFiles = req.files.videos;
    } else {
      videoFiles = [req.files.videos];
    }

    // サポートする動画形式の確認
    const supportedFormats = [
      "video/mp4",
      "video/avi",
      "video/quicktime",
      "video/x-matroska",
      "video/x-ms-wmv",
      "video/x-flv",
    ];

    const validFiles = videoFiles.filter((file) =>
      supportedFormats.includes(file.mimetype)
    );

    if (validFiles.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "サポートされている動画ファイルがありません",
      });
    }

    // 処理結果を格納する配列
    const results = [];
    const processPromises = [];

    // 各ファイルを処理
    for (const [index, file] of validFiles.entries()) {
      const uniqueId = uuidv4();
      const fileExt = path.extname(file.name);
      const baseFileName = path.basename(file.name, fileExt);
      const uploadPath = path.join(uploadDir, `${uniqueId}${fileExt}`);
      const outputPath = path.join(
        processedDir,
        `${baseFileName}_processed_${uniqueId}.mp4`
      );

      // ファイルの移動
      await file.mv(uploadPath);

      // FFmpeg処理のプロミスを作成
      const processPromise = new Promise((resolve, reject) => {
        // FFmpegコマンドを構築
        const ffmpeg = spawn("ffmpeg", [
          "-i",
          uploadPath,
          "-vf",
          "transpose=2,scale=256:128,pad=384:256:128:128:black",
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-y",
          outputPath,
        ]);

        ffmpeg.on("close", (code) => {
          // 処理完了後、一時ファイルを削除
          fs.unlink(uploadPath, () => {});

          if (code === 0) {
            // 成功
            resolve({
              originalName: file.name,
              processedName: `${baseFileName}_processed_${uniqueId}.mp4`,
              status: "success",
              downloadUrl: `/api/download/${baseFileName}_processed_${uniqueId}.mp4`,
            });
          } else {
            // エラー
            reject(new Error(`FFmpeg処理エラー (コード: ${code})`));
          }
        });

        ffmpeg.on("error", (err) => {
          reject(err);
        });
      });

      processPromises.push(
        processPromise
          .then((result) => {
            results.push(result);
            return result;
          })
          .catch((err) => {
            results.push({
              originalName: file.name,
              status: "error",
              message: err.message,
            });
          })
      );
    }

    // すべての処理が完了するのを待つ
    await Promise.all(processPromises);

    // 結果を返す
    return res.status(200).json({
      status: "success",
      results,
    });
  } catch (err) {
    console.error("エラー:", err);
    return res.status(500).json({
      status: "error",
      message: `サーバーエラーが発生しました: ${err.message}`,
    });
  }
});

// ダウンロードエンドポイント
app.get("/api/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(processedDir, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({
      status: "error",
      message: "ファイルが見つかりません",
    });
  }
});

// 定期的なクリーンアップ - 24時間以上経過したファイルを削除
function cleanupOldFiles() {
  const RETENTION_PERIOD = 24 * 60 * 60 * 1000; // 24時間（ミリ秒）

  fs.readdir(processedDir, (err, files) => {
    if (err) return;

    const now = Date.now();
    files.forEach((file) => {
      const filePath = path.join(processedDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        // ファイルの最終更新時間から経過時間を計算
        const fileAge = now - stats.mtime.getTime();

        // 保持期間を超えたファイルを削除
        if (fileAge > RETENTION_PERIOD) {
          fs.unlink(filePath, () => {});
        }
      });
    });
  });
}

// 1時間ごとにクリーンアップを実行
setInterval(cleanupOldFiles, 60 * 60 * 1000);

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
  console.log(`環境: ${process.env.NODE_ENV || "development"}`);
});
