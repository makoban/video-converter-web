// public/app.js - クライアント側の動画圧縮機能を追加 (v1.1)

document.addEventListener("DOMContentLoaded", function () {
  // DOM要素
  const uploadForm = document.getElementById("upload-form");
  const fileInput = document.getElementById("video-upload");
  const dropArea = document.getElementById("drop-area");
  const fileListContainer = document.getElementById("file-list-container");
  const fileList = document.getElementById("file-list");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const resultsContainer = document.getElementById("results-container");
  const resultsBody = document.getElementById("results-body");
  const uploadButton = document.getElementById("upload-button");
  const compressionInfo = document.getElementById("compression-info");

  // 選択されたファイルとその圧縮バージョンを保持する変数
  let selectedFiles = [];
  let compressedFiles = [];
  let isCompressing = false;
  let filesReadyToUpload = false;

  // FFmpegインスタンス
  let ffmpeg = null;

  // 動画圧縮のための設定
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const TARGET_SIZE = 95 * 1024 * 1024; // 少し余裕を持たせて95MB
  const MAX_WIDTH = 1280; // 横幅の最大値
  const MAX_HEIGHT = 720; // 高さの最大値

  // FFmpegの初期化
  const initFFmpeg = async () => {
    try {
      ffmpeg = FFmpeg.createFFmpeg({ log: false });
      await ffmpeg.load();
      console.log("FFmpeg loaded");
      return true;
    } catch (error) {
      console.error("FFmpeg loading error:", error);
      return false;
    }
  };

  // ファイル選択時の処理
  fileInput.addEventListener("change", function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 選択されたファイルを保存
    selectedFiles = files.filter((file) => file.type.startsWith("video/"));

    if (selectedFiles.length === 0) {
      alert("サポートされている動画ファイルがありません。");
      return;
    }

    // 圧縮が必要かチェックして表示を更新
    checkAndStartCompression();
  });

  // ドラッグ&ドロップ処理
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    dropArea.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropArea.addEventListener(eventName, unhighlight, false);
  });

  function highlight() {
    dropArea.classList.add("highlight");
  }

  function unhighlight() {
    dropArea.classList.remove("highlight");
  }

  dropArea.addEventListener("drop", handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = Array.from(dt.files);

    // 選択されたファイルを保存
    selectedFiles = files.filter((file) => file.type.startsWith("video/"));

    if (selectedFiles.length === 0) {
      alert("サポートされている動画ファイルがありません。");
      return;
    }

    // 圧縮が必要かチェックして表示を更新
    checkAndStartCompression();
  }

  // ファイルリストの更新と圧縮の必要性チェック
  function updateFileList() {
    // ファイルリストをクリア
    fileList.innerHTML = "";
    fileListContainer.classList.remove("d-none");

    // 圧縮情報をリセット
    if (compressionInfo) {
      compressionInfo.classList.add("d-none");
    }

    // 各ファイルについて処理
    let needsCompression = false;

    selectedFiles.forEach((file, index) => {
      const needsCompress = file.size > MAX_FILE_SIZE;
      if (needsCompress) needsCompression = true;

      // リストアイテムを作成
      const listItem = document.createElement("li");
      listItem.className = "list-group-item";
      listItem.id = `file-item-${index}`;

      const fileInfo = document.createElement("div");
      fileInfo.className = "file-info";

      const icon = document.createElement("i");
      icon.className = "bi bi-film";
      fileInfo.appendChild(icon);

      const fileDetails = document.createElement("div");
      fileDetails.style.width = "100%";

      const fileHeader = document.createElement("div");
      fileHeader.className =
        "d-flex justify-content-between align-items-center";

      const fileName = document.createElement("div");
      fileName.className = "file-name";
      fileName.textContent = file.name;
      fileHeader.appendChild(fileName);

      const fileSize = document.createElement("div");
      fileSize.className =
        "file-size badge " + (needsCompress ? "bg-warning" : "bg-success");
      fileSize.textContent =
        formatFileSize(file.size) + (needsCompress ? " (圧縮必要)" : "");
      fileSize.id = `file-size-${index}`;
      fileHeader.appendChild(fileSize);

      fileDetails.appendChild(fileHeader);

      // 圧縮が必要なファイルには進捗バーを追加
      if (needsCompress) {
        const compressionProgress = document.createElement("div");
        compressionProgress.className = "progress mt-2";
        compressionProgress.style.height = "10px";
        compressionProgress.id = `compression-progress-${index}`;
        compressionProgress.innerHTML = `<div class="progress-bar bg-info" role="progressbar" style="width: 0%"
                                       aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>`;
        fileDetails.appendChild(compressionProgress);

        const compressionStatus = document.createElement("small");
        compressionStatus.className = "text-muted mt-1";
        compressionStatus.id = `compression-status-${index}`;
        compressionStatus.textContent = "圧縮準備中...";
        fileDetails.appendChild(compressionStatus);
      }

      fileInfo.appendChild(fileDetails);
      listItem.appendChild(fileInfo);

      const removeBtn = document.createElement("i");
      removeBtn.className = "bi bi-x-circle remove-file";
      removeBtn.addEventListener("click", () => {
        selectedFiles.splice(index, 1);
        if (compressedFiles[index]) {
          compressedFiles.splice(index, 1);
        }
        listItem.remove();

        if (selectedFiles.length === 0) {
          fileListContainer.classList.add("d-none");
          if (compressionInfo) {
            compressionInfo.classList.add("d-none");
          }
          filesReadyToUpload = false;
        }
      });
      listItem.appendChild(removeBtn);

      fileList.appendChild(listItem);
    });

    // 圧縮が必要なファイルがある場合は圧縮情報を表示
    if (needsCompression && compressionInfo) {
      compressionInfo.classList.remove("d-none");
      compressionInfo.innerHTML = `
        <div class="alert alert-warning">
          <h5><i class="bi bi-exclamation-triangle me-2"></i>大きなファイルが検出されました</h5>
          <p>100MB以上のファイルは自動的に圧縮されます。しばらくお待ちください。</p>
          <p>圧縮処理にはお使いのブラウザとデバイスの性能によって時間がかかる場合があります。</p>
          <div class="progress mt-2" id="overall-compression-progress">
            <div class="progress-bar bg-warning progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"
                 aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
          <p id="overall-compression-status" class="text-center mt-2">FFmpegを読み込み中...</p>
        </div>
      `;

      // 自動的に圧縮を開始
      startCompression();
    } else {
      // 圧縮が不要な場合はそのままアップロード可能にする
      filesReadyToUpload = true;
      compressedFiles = [...selectedFiles];
    }
  }

  // 圧縮処理を開始する関数
  async function startCompression() {
    if (isCompressing) return;

    isCompressing = true;
    uploadButton.disabled = true;

    const overallProgress = document.querySelector(
      "#overall-compression-progress .progress-bar"
    );
    const overallStatus = document.getElementById("overall-compression-status");

    if (!ffmpeg) {
      if (overallStatus) overallStatus.textContent = "FFmpegを読み込み中...";
      const loaded = await initFFmpeg();
      if (!loaded) {
        alert(
          "FFmpegの読み込みに失敗しました。ブラウザをリロードして再試行してください。"
        );
        if (overallStatus)
          overallStatus.textContent = "FFmpegの読み込みに失敗しました";
        isCompressing = false;
        uploadButton.disabled = false;
        return;
      }
    }

    // 圧縮対象のファイル数をカウント
    const largeFiles = selectedFiles.filter(
      (file) => file.size > MAX_FILE_SIZE
    );
    let compressedCount = 0;

    // 自動的にすべてのファイルを圧縮
    try {
      // 初期状態として圧縮元ファイルと同じサイズの配列を作成
      compressedFiles = new Array(selectedFiles.length);

      // 圧縮が必要なファイルのみを処理
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        if (file.size > MAX_FILE_SIZE) {
          // 圧縮が必要なファイル
          if (overallStatus)
            overallStatus.textContent = `ファイル ${i + 1}/${
              selectedFiles.length
            } を圧縮中...`;
          if (overallProgress) {
            overallProgress.style.width = `${Math.round(
              (compressedCount / largeFiles.length) * 100
            )}%`;
            overallProgress.setAttribute(
              "aria-valuenow",
              Math.round((compressedCount / largeFiles.length) * 100)
            );
          }

          try {
            const compressedFile = await compressVideo(file, i);
            compressedFiles[i] = compressedFile;
            compressedCount++;
          } catch (error) {
            console.error(`File ${i} compression error:`, error);
            // 圧縮に失敗した場合は元のファイルを使用
            compressedFiles[i] = file;

            const statusElement = document.getElementById(
              `compression-status-${i}`
            );
            if (statusElement) {
              statusElement.textContent = `圧縮に失敗しました: ${
                error.message || "エラー"
              }`;
              statusElement.classList.remove("text-muted");
              statusElement.classList.add("text-danger");
            }
          }
        } else {
          // 圧縮が不要なファイルはそのまま
          compressedFiles[i] = file;
        }
      }

      // すべての圧縮が完了
      if (overallStatus)
        overallStatus.textContent = "すべてのファイルの圧縮が完了しました";
      if (overallProgress) {
        overallProgress.style.width = "100%";
        overallProgress.setAttribute("aria-valuenow", 100);
        overallProgress.classList.remove("bg-warning");
        overallProgress.classList.add("bg-success");
      }

      // 処理ボタンを有効化
      uploadButton.disabled = false;
      isCompressing = false;
      filesReadyToUpload = true;

      // 圧縮情報を更新
      if (compressionInfo) {
        compressionInfo.innerHTML = `
          <div class="alert alert-success">
            <h5><i class="bi bi-check-circle me-2"></i>圧縮処理が完了しました</h5>
            <p>すべてのファイルの圧縮が完了しました。「処理開始」ボタンをクリックして変換処理を開始してください。</p>
          </div>
        `;
      }
    } catch (error) {
      console.error("圧縮処理中にエラーが発生しました:", error);
      if (overallStatus)
        overallStatus.textContent = `エラー: ${
          error.message || "圧縮処理中にエラーが発生しました"
        }`;

      alert("一部のファイルの圧縮に失敗しました。");

      // 圧縮に失敗した場合でも処理ボタンは有効にする
      uploadButton.disabled = false;
      isCompressing = false;
    }
  }

  // ファイルがアップロードされたらチェックと圧縮を開始
  function checkAndStartCompression() {
    filesReadyToUpload = false;
    updateFileList();
  }

  // ファイルサイズのフォーマット
  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // FFmpeg.wasmを使用して動画を圧縮する関数
  async function compressVideo(file, index) {
    try {
      // 圧縮進捗要素を取得
      const progressElement = document.getElementById(
        `compression-progress-${index}`
      );
      const statusElement = document.getElementById(
        `compression-status-${index}`
      );
      const progressBar = progressElement?.querySelector(".progress-bar");
      const fileSizeElement = document.getElementById(`file-size-${index}`);

      if (statusElement) {
        statusElement.textContent = "ファイルを読み込み中...";
      }

      // ファイル名を生成
      const name = `input_${index}${getExtension(file.name)}`;
      const outputName = `output_${index}.mp4`;

      // ファイルをArrayBufferに変換
      const data = await file.arrayBuffer();
      const uint8Array = new Uint8Array(data);

      // FFmpegにファイルを書き込む
      ffmpeg.FS("writeFile", name, uint8Array);

      if (statusElement) {
        statusElement.textContent = "動画を圧縮中...0%";
      }

      // 圧縮設定を決定
      // ファイルサイズに応じてビットレートを調整（簡易的な計算）
      const targetBitrate = Math.min(
        1000,
        Math.floor(1000 * (TARGET_SIZE / file.size))
      );
      const bitrateKb = Math.max(500, targetBitrate); // 最低500kbpsを保証

      // プログレスコールバック
      ffmpeg.setProgress(({ ratio }) => {
        if (progressBar) {
          const percent = Math.round(ratio * 100);
          progressBar.style.width = `${percent}%`;
          progressBar.setAttribute("aria-valuenow", percent);
        }
        if (statusElement) {
          statusElement.textContent = `動画を圧縮中...${Math.round(
            ratio * 100
          )}%`;
        }
      });

      // FFmpegコマンドを実行
      await ffmpeg.run(
        "-i",
        name,
        "-vf",
        `scale='min(${MAX_WIDTH},iw)':'-2'`,
        "-c:v",
        "libx264",
        "-crf",
        "28",
        "-preset",
        "fast",
        "-b:v",
        `${bitrateKb}k`,
        "-maxrate",
        `${bitrateKb * 1.5}k`,
        "-bufsize",
        `${bitrateKb * 3}k`,
        "-movflags",
        "+faststart",
        "-y",
        outputName
      );

      // 圧縮されたファイルを取得
      const outputData = ffmpeg.FS("readFile", outputName);

      // メモリを解放
      ffmpeg.FS("unlink", name);
      ffmpeg.FS("unlink", outputName);

      // 圧縮したファイルをBlobに変換
      const compressedBlob = new Blob([outputData.buffer], {
        type: "video/mp4",
      });

      // ファイル名を維持
      const fileName = getFilenameWithoutExtension(file.name) + ".mp4";

      // File オブジェクトに変換
      const compressedFile = new File([compressedBlob], fileName, {
        type: "video/mp4",
      });

      // 進捗表示を更新
      if (progressBar) {
        progressBar.style.width = "100%";
        progressBar.setAttribute("aria-valuenow", 100);
        progressBar.classList.remove("bg-info");
        progressBar.classList.add("bg-success");
      }

      if (statusElement) {
        statusElement.textContent = `圧縮完了: ${formatFileSize(
          file.size
        )} → ${formatFileSize(compressedFile.size)}`;
      }

      if (fileSizeElement) {
        fileSizeElement.textContent = formatFileSize(compressedFile.size);
        fileSizeElement.classList.remove("bg-warning");
        fileSizeElement.classList.add("bg-success");
      }

      return compressedFile;
    } catch (error) {
      console.error("動画圧縮エラー:", error);

      const statusElement = document.getElementById(
        `compression-status-${index}`
      );

      if (statusElement) {
        statusElement.textContent = `エラー: ${
          error.message || "圧縮に失敗しました"
        }`;
        statusElement.classList.remove("text-muted");
        statusElement.classList.add("text-danger");
      }

      throw error;
    }
  }

  // ファイル名から拡張子を取得
  function getExtension(filename) {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 1);
  }

  // ファイル名から拡張子を除いた部分を取得
  function getFilenameWithoutExtension(filename) {
    return filename.substring(0, filename.lastIndexOf(".")) || filename;
  }

  // フォーム送信（ファイル処理開始）
  uploadForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (selectedFiles.length === 0) {
      alert("処理するファイルを選択してください。");
      return;
    }

    // 圧縮処理中は処理開始ボタンをクリックできないようにする
    if (isCompressing) {
      alert("圧縮処理中です。完了までお待ちください。");
      return;
    }

    // ファイルの準備ができていない場合は待機
    if (!filesReadyToUpload) {
      alert("ファイルの圧縮処理中です。完了までお待ちください。");
      return;
    }

    // 処理するファイルがない場合
    if (compressedFiles.filter((file) => file !== null).length === 0) {
      alert("処理できるファイルがありません。");
      return;
    }

    // UIの更新
    uploadButton.disabled = true;
    progressContainer.classList.remove("d-none");
    resultsContainer.classList.add("d-none");
    progressBar.style.width = "0%";
    progressBar.setAttribute("aria-valuenow", 0);
    progressText.textContent = "処理を開始しています...";

    // FormDataの作成
    const formData = new FormData();
    compressedFiles.forEach((file) => {
      if (file) {
        formData.append("videos", file);
      }
    });

    // 進捗シミュレーション
    let progress = 0;
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += 0.5 + Math.random();
        const progressValue = Math.min(90, Math.floor(progress));
        progressBar.style.width = `${progressValue}%`;
        progressBar.setAttribute("aria-valuenow", progressValue);
        progressText.textContent = `動画を処理中... ${progressValue}%`;
      }
    }, 300);

    // APIリクエスト
    fetch("/api/process-videos", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("サーバーエラーが発生しました。");
        }
        return response.json();
      })
      .then((data) => {
        // 進捗バーを完了状態に
        clearInterval(progressInterval);
        progressBar.style.width = "100%";
        progressBar.setAttribute("aria-valuenow", 100);
        progressText.textContent = "処理完了！";

        // 結果テーブルの表示
        resultsContainer.classList.remove("d-none");
        resultsBody.innerHTML = "";

        if (data.results && data.results.length > 0) {
          data.results.forEach((result) => {
            const row = document.createElement("tr");

            // ファイル名
            const nameCell = document.createElement("td");
            nameCell.textContent = result.originalName;
            row.appendChild(nameCell);

            // 状態
            const statusCell = document.createElement("td");
            if (result.status === "success") {
              statusCell.innerHTML =
                '<span class="badge bg-success status-badge">成功</span>';
            } else {
              statusCell.innerHTML = `<span class="badge bg-danger status-badge">失敗</span>`;
              if (result.message) {
                const errorText = document.createElement("div");
                errorText.className = "text-danger mt-1 small";
                errorText.textContent = result.message;
                statusCell.appendChild(errorText);
              }
            }
            row.appendChild(statusCell);

            // ダウンロード
            const downloadCell = document.createElement("td");
            if (result.status === "success") {
              const downloadBtn = document.createElement("a");
              downloadBtn.href = result.downloadUrl;
              downloadBtn.className = "btn btn-sm btn-primary download-btn";
              downloadBtn.innerHTML =
                '<i class="bi bi-download"></i> ダウンロード';
              downloadBtn.setAttribute("download", "");
              downloadCell.appendChild(downloadBtn);
            } else {
              downloadCell.textContent = "-";
            }
            row.appendChild(downloadCell);

            resultsBody.appendChild(row);
          });
        } else {
          // 結果が空の場合
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = 3;
          cell.className = "text-center";
          cell.textContent = "処理結果がありません";
          row.appendChild(cell);
          resultsBody.appendChild(row);
        }

        // 送信ボタンを再度有効化
        uploadButton.disabled = false;
      })
      .catch((error) => {
        clearInterval(progressInterval);
        progressBar.style.width = "100%";
        progressBar.classList.remove("bg-primary");
        progressBar.classList.add("bg-danger");
        progressText.textContent = `エラー: ${error.message}`;
        uploadButton.disabled = false;
        console.error("Error:", error);
      });
  });
});
