# なないろ歯科 兵庫・芦屋医院 アンケート集計サイト

「当院の矯正を選んでいただいた理由について」アンケートを集計する社内用ウェブアプリです。
React + Vite 製。データは **Firebase Firestore** に保存し、**Vercel** で公開します。
ログインなし。回答の **追加・編集・削除・CSV書き出し** ができます。

> ⚠️ 患者の氏名・連絡先（個人情報）を含みます。ログインがない分、**URLを知っている人は誰でも閲覧・編集できます**。公開リンクを社外・不特定多数に共有しないでください。

---

## 全体の流れ

```
アンケート画像 → Claudeが読み取り → seedData.js を更新 → GitHubにpush
        → Vercelが自動デプロイ → アプリの「手入力／取り込み」で取り込み
        → 集計・編集はアプリ上（Firestore）で
```

Firebaseの鍵はコードに直書き済み（src/firebase.js）なので、**環境変数の設定は不要**です。

---

## セットアップ（初回のみ）

### 1. Firestore を用意する
1. Firebase コンソールのプロジェクト questionnaire-26436 を開く。
2. Firestore Database を作成（未作成の場合）。
3. Firestore → ルール に、本リポジトリの firestore.rules の内容を貼り付けて「公開」。
   （認証なしで読み書きできる設定です）

### 2. GitHub にアップロード
    cd naniiro-survey
    git init
    git add .
    git commit -m "初回コミット"
    git branch -M main
    git remote add origin https://github.com/＜ユーザー名＞/naniiro-survey.git
    git push -u origin main

### 3. Vercel でデプロイ
1. Vercel で New Project → 上記リポジトリを Import。
2. Framework は自動で Vite（Build: npm run build / Output: dist）。
3. Deploy。発行されたURLで開けば完成です（環境変数の登録は不要）。

---

## 日々の運用

### 回答を増やすとき
1. アンケートの写真を Claude に送る。
2. Claude が src/seedData.js に追記したものを受け取り、GitHub に push（Vercelが自動再デプロイ）。
3. デプロイ後、アプリの「手入力／取り込み」タブ →「初期データ(seed)を取り込む」を押すと、
   未登録分だけ Firestore に追加されます（重複しません）。
   もしくは Claude から渡された JSON を「JSONを貼り付けて取り込む」で直接取り込んでもOK（push不要）。

### 読み取りミスを直すとき
- 「回答データ」タブの各カードの「編集」から修正（Firestoreに即保存）。
- または Claude に「#3 のQ5は◯◯」と伝えて直してもらう。

### 手入力で1件追加するとき
- 「手入力／取り込み」タブのフォームから入力 →「この回答を追加する」。

### 書き出し
- 集計（匿名・学会用）／回答者名簿／後日連絡先 を、それぞれ CSV で書き出せます。

---

## ローカルで動かす（任意）
    npm install
    npm run dev      # http://localhost:5173

## 注意（プライバシー）
- 個人情報（氏名・連絡先）を含みます。URLの共有範囲にご注意ください。
- 「あとで関係者だけに制限したい」場合は、簡易パスコードやVercelのパスワード保護を追加できます。
- 学会発表用の集計は匿名です（CSVの「集計(匿名)」に個人情報は含まれません）。
