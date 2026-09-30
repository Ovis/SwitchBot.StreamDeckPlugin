# SwitchBot.StreamDeckPlugin

[English](README.md) | 日本語

SwitchBot OpenAPI v1.1を利用して、Elgato Stream DeckからSwitchBotデバイスを操作するためのプラグインです。

Bot、照明、エアコン、ロック、カーテンなどのデバイスをStream Deckのキーから直接操作できるほか、デバイスの状態取得、赤外線リモコンの操作、任意のSwitchBot APIリクエストにも対応しています。

## インストール

[GitHub Releases](https://github.com/Ovis/SwitchBot.StreamDeckPlugin/releases) から最新リリースの `.streamDeckPlugin` ファイルをダウンロードしてください。

ダウンロードした `.streamDeckPlugin` ファイルを開くと、Stream Deckへプラグインをインストールできます。

### 動作環境

- Stream Deck 7.1以降
- Windows 10以降
- macOS 13以降
- SwitchBotアカウント
- SwitchBot OpenAPIのToken / Secret

## 初期設定

本プラグインからSwitchBotデバイスを操作するには、SwitchBot OpenAPIの **Token** と **Secret** が必要です。

TokenとSecretの取得方法については、SwitchBot公式サポートを参照してください。

- [SwitchBot公式サポート「トークンの取得方法」](https://support.switch-bot.com/hc/ja/articles/12822710195351-%E3%83%88%E3%83%BC%E3%82%AF%E3%83%B3%E3%81%AE%E5%8F%96%E5%BE%97%E6%96%B9%E6%B3%95)

取得後は、次の手順でプラグインに設定します。

1. Stream Deck上の空いているキーに、本プラグインのアクションをどれか1つ配置します。
2. 配置したアクションを選択し、設定画面の一番下にある **「認証」** を開きます。
3. 取得した **Token** と **Secret** を入力します。
4. **「接続テスト」** を実行し、正常に接続できることを確認します。

TokenとSecretはプラグイン全体で共有されます。**一度設定すれば、他のアクションで再度設定する必要はありません。**

## 主な機能

### デバイス操作

SwitchBotデバイスを用途別のアクションから操作できます。

| アクション | 主な用途 |
| --- | --- |
| **Bot** | SwitchBot Botの操作 |
| **電源** | プラグやリレーなど、電源系デバイスの操作 |
| **照明** | 照明デバイスの操作 |
| **空調** | エアコンなど、空調デバイスの操作 |
| **セキュリティ** | Lockなど、セキュリティデバイスの操作 |
| **カーテン・ブラインド** | Curtain、Blind Tilt、Roller Shadeなどの操作 |
| **掃除** | ロボット掃除機の操作 |

各アクションでは、選択したデバイスで利用可能な操作とパラメーターを設定できます。

ロック解除などのセキュリティ上重要な操作では、誤操作を防止するため確認操作を行います。

### 赤外線リモコン

SwitchBot Hubに登録されている赤外線リモコンをStream Deckから操作できます。

テレビやエアコンなど、SwitchBotの仮想赤外線リモコンとして登録されている機器を選択し、対応するコマンドを実行できます。

### 状態取得

SwitchBotデバイスの現在の状態を取得できます。

取得結果をStream Deckのキー上に表示でき、表示テンプレートを使用して表示する項目やレイアウトを変更できます。

例えば、次のようなテンプレートを設定できます。

```text
温度: {temperature}°C
湿度: {humidity}%
```

一度ステータスを取得すると、取得した情報から利用可能な項目が設定画面に表示されます。表示したい項目をクリックしてテンプレートへ追加することもできます。

表示テンプレートを空欄にした場合は、取得した情報から主要な項目を自動的に選んで表示します。

状態の自動更新にも対応しており、次の更新間隔を選択できます。

- 手動のみ
- 1分
- 2分
- 5分
- 10分
- 30分
- 60分

手動で取得する場合は、Stream Deckのキーを押すとその場で最新の状態を取得します。

必要に応じて、完全なレスポンスJSONをクリップボードへコピーすることもできます。

### APIリクエスト

より高度な用途向けに、SwitchBot OpenAPIへ直接リクエストを送信できます。

一般的なデバイス、シーン、Webhook APIについてはプリセットを利用できます。

Customモードでは、SwitchBot APIに対するGET / POST / PUT / DELETEリクエストを設定できます。

通常のデバイス操作アクションでは対応していないAPIを利用したい場合や、より詳細なリクエストを構成したい場合に利用できます。

レスポンスをクリップボードへコピーすることもできます。

## 対応デバイスについて

SwitchBot OpenAPIで利用できるすべてのデバイスが、デバイス操作に対応しているわけではありません。

本プラグインではSwitchBot OpenAPIのControl Commands対応状況に基づいて、各デバイス操作アクションで操作可能なデバイスを選択肢として表示します。

Meter、Contact Sensor、Hubなど、状態の取得には対応していてもControl Commandsによる操作には対応していないデバイスは、「状態取得」では利用できますが、デバイス操作アクションの選択肢には表示されません。

## 免責事項

本プラグインはSwitchBot OpenAPIを利用してデバイスを操作しますが、**SwitchBot OpenAPIで利用可能なすべてのデバイス・操作への対応を保証するものではありません。**

開発者が実機で動作確認できているデバイスは一部に限られます。プラグイン上で対応デバイスとして表示される場合でも、デバイス、ファームウェア、SwitchBot OpenAPIの仕様変更などによって正常に動作しない可能性があります。

また、開発時の実機動作確認はWindows環境で行っています。macOSはプラグインの対応対象に含まれていますが、開発者による実機での動作確認は行っていません。

## 開発

開発にはNode.js 24以降が必要です。

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run validate
```

### 技術構成

- TypeScript
- Node.js 24
- Stream Deck SDK 3.x
- SwitchBot OpenAPI v1.1
- Zod
- Vitest

詳細な実装仕様については [`docs/IMPLEMENTATION_SPEC.md`](docs/IMPLEMENTATION_SPEC.md) を参照してください。

## ライセンス

ライセンスについては、リポジトリのLICENSEファイルを参照してください。
