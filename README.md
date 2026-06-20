# なないろ歯科 兵庫・芦屋医院 アンケート集計サイト

「当院の矯正を選んでいただいた理由について」アンケートを集計するための社内用ウェブアプリです。
React + Vite 製。データは **Firebase Firestore** に保存し、**Vercel** で公開します。
ログイン操作は不要（裏で匿名サインインして動作）。回答の **追加・編集・削除・CSV書き出し** ができます。

> ⚠️ このアプリには患者の氏名・連絡先（個人情報）が含まれます。**URLを知っている人は誰でも閲覧・編集できます**（画面ログインなし）。公開リンクを不特定多数に共有しないでください。データベース自体は匿名認証＋ルールで保護しています。

---

## 全体の流れ

```
アンケート画像 → Claudeが読み取り → seedData.js を更新 → GitHubにpush
        → Vercelが自動デプロイ → アプリの「手入力／取り込み」で取り込み
        → 集計・編集はアプリ上（Firestore）で
```

---

## 1. 必要なもの

- Node.js 18 以上
- GitHub アカウント
- Firebase（Google）アカウント
- Vercel アカウント

## 2. Firebase の準備

1. [Firebase コンソール](https://console.firebase.google.com/) で**プロジェクトを作成**。
2. **Firestore Database** を作成（本番モードで開始）。
3. **Authentication** → Sign-in method → **匿名（Anonymous）** を有効化。
   （ログイン画面は出ません。アプリが自動で匿名サインインします）
4. プロジェクト設定 → マイアプリ → **ウェブアプリ（</>）を追加**し、表示される `firebaseConfig` の値を控える。
5. Firestore → ルール に、本リポジトリの `firestore.rules` の内容を貼り付けて**公開**。
   （ログイン済みユーザーのみ読み書き可能になります）

## 3. ローカルで動かす（任意）

```bash
npm install
cp .env.example .env      # .env に Firebase の値を記入
npm run dev               # http://localhost:5173
```

`.env` の例：

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxxx
VITE_FIREBASE_STORAGE_BUCKET=xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

## 4. GitHub にアップロード

```bash
git init
git add .
git commit -m "初回コミット"
git branch -M main
git remote add origin https://github.com/＜ユーザー名＞/naniiro-survey.git
git push -u origin main
```

`.env` は `.gitignore` 済みなので push されません（鍵はVercel側に登録します）。

## 5. Vercel でデプロイ

1. [Vercel](https://vercel.com/) で **New Project** → 上記GitHubリポジトリを Import。
2. Framework は自動で **Vite** が選ばれます（Build: `npm run build` / Output: `dist`）。
3. **Settings → Environment Variables** に、`.env` と同じ6つの `VITE_FIREBASE_*` を登録。
4. Deploy。発行されたURLでアプリが開きます。
5. Firebase Authentication → Settings → **承認済みドメイン** に、Vercelのドメイン（`xxxx.vercel.app` や独自ドメイン）を追加。

---

## 日々の運用

### 回答を増やすとき
1. アンケートの**写真を Claude に送る**。
2. Claude が読み取って `src/seedData.js` に追記したものを受け取り、**GitHub に push**（Vercelが自動再デプロイ）。
3. デプロイ後、アプリの **「手入力／取り込み」タブ → 「初期データ(seed)を取り込む」** を押すと、未登録分だけ Firestore に追加されます（重複しません）。
   - もしくは Claude から渡された JSON を「JSONを貼り付けて取り込む」で直接取り込んでもOK（push不要）。

### 読み取りミスを直すとき
- 「回答データ」タブの各カードの **「編集」** から修正（Firestoreに即保存）。
- または Claude に「#3 のQ5は◯◯」と伝えて直してもらう。

### 手入力で1件追加するとき
- 「手入力／取り込み」タブのフォームから入力 →「この回答を追加する」。

### 書き出し
- 集計（匿名・学会用）／回答者名簿／後日連絡先 を、それぞれ CSV で書き出せます。

---

## データ構造（Firestore: `responses` コレクション）

各ドキュメントのフィールドは `src/seedData.js` の各オブジェクトと同じです（`q1`〜`q13`、患者番号・氏名、後日連絡先など）。`createdAt` の昇順で並びます。

## 注意（プライバシー）

- 個人情報（氏名・連絡先）が含まれます。`firestore.rules` を必ず「認証必須」のまま運用してください。
- 学会発表用の集計は匿名です（CSVの「集計(匿名)」に個人情報は含まれません）。
