# 家的提案

家庭空間討論工具，提供三房三衛示意配置、2D 家具編輯、3D 鳥瞰與漫遊、風格切換及 JSON 備份。

## 使用方式

- 電腦可編輯與查看；手機可查看及操作。尺寸、窗景及材質仍是示意。
- 方案只保存在目前網址、目前瀏覽器；不自動同步，也不會上傳到網站伺服器。
- 搬移裝置或網址前，先匯出 JSON，再到新網站匯入。備份可能包含自行輸入的需求及圖片，請自行選擇分享對象。
- 網站沒有內建工程照片。可自行匯入 JPG／PNG／WebP，圖片在瀏覽器本機處理。
- 如果舊 JSON 只引用原電腦的內建圖，請回原網站匯出完整備份；也可以匯入方案後重新選擇圖片。缺圖會顯示提示，原引用保留。
- 舊版本相容識別採指紋比對；讀取時不重寫備份的名稱或 ID。新方案使用通用名稱。

## 本機開發與部署

需要 Node.js 22 與 npm。

```sh
npm ci
npm run dev
npm test
npm run build:pages
npm run preview:pages
```

Pages 建置使用 `/HOUSE/` 路徑；預覽預設在 `http://127.0.0.1:4173/HOUSE/`。輸出 `dist-pages` 經允許清單處理後成為 `dist-hosted`，只發布後者。公開來源可獨立建置，不需要原始照片。

GitHub Settings → Pages 的來源設為 GitHub Actions。工作流程僅支援手動 `workflow_dispatch`；推送不會自動部署。確認待發布版本後，在 Actions 執行 Deploy Pages。測試／建置成功才上傳成品並部署。

部署回退：選擇先前核准版本重新建置發布。停止對外提供時，在儲存庫 Pages 設定取消發布。首次正式上線後仍需實體手機與 Safari 驗收。

## 驗證

`npm test` 執行單元測試。`npm run test:pages` 使用本機 Chrome，預設造訪 `http://127.0.0.1:4173/HOUSE/`，可用 `TEST_ORIGIN` 指定完整預覽網址；結果寫至忽略的 verification 目錄。

官方流程：[Vite GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages)、[GitHub 自訂發布工作流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
