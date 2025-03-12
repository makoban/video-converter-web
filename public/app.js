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

  // 選択されたファイルを保持する配列
  let selectedFiles = [];

  // ファイル選択時の処理
  fileInput.addEventListener("change", function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    addFilesToList(files);
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
    if (files.length === 0) return;

    addFilesToList(files);
  }

  // ファイルをリストに追加
  function addFilesToList(files) {
    // 動画ファイルのみをフィルタリング
    const videoFiles = files.filter((file) => file.type.startsWith("video/"));
    if (videoFiles.length === 0) {
      alert("サポートされている動画ファイルがありません。");
      return;
    }

    // 既存のリストをクリア
    fileList.innerHTML = "";
    selectedFiles = videoFiles;

    // ファイルリストを表示
    fileListContainer.classList.remove("d-none");

    // ファイルをリストに追加
    videoFiles.forEach((file, index) => {
      const listItem = document.createElement("li");
      listItem.className = "list-group-item";

      const fileInfo = document.createElement("div");
      fileInfo.className = "file-info";

      const icon = document.createElement("i");
      icon.className = "bi bi-film";
      fileInfo.appendChild(icon);

      const fileDetails = document.createElement("div");

      const fileName = document.createElement("div");
      fileName.className = "file-name";
      fileName.textContent = file.name;
      fileDetails.appendChild(fileName);

      const fileSize = document.createElement("div");
      fileSize.className = "file-size";
      fileSize.textContent = formatFileSize(file.size);
      fileDetails.appendChild(fileSize);

      fileInfo.appendChild(fileDetails);
      listItem.appendChild(fileInfo);

      const removeBtn = document.createElement("i");
      removeBtn.className = "bi bi-x-circle remove-file";
      removeBtn.addEventListener("click", () => {
        selectedFiles.splice(index, 1);
        listItem.remove();

        if (selectedFiles.length === 0) {
          fileListContainer.classList.add("d-none");
        }
      });
      listItem.appendChild(removeBtn);

      fileList.appendChild(listItem);
    });
  }

  // ファイルサイズのフォーマット
  function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  // フォーム送信（ファイル処理開始）
  uploadForm.addEventListener("submit", function (e) {
    e.preventDefault();

    if (selectedFiles.length === 0) {
      alert("処理するファイルを選択してください。");
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
    selectedFiles.forEach((file) => {
      formData.append("videos", file);
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
