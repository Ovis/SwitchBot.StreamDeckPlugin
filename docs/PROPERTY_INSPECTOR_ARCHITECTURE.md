# Property Inspector 共通アーキテクチャ — v1.1

## 1. 目的

v1.0.1を、本リファクタリング開始前の安定版として扱う。

v1.1.0以降では、ActionごとのUIの違いによってsettingsの永続化方式やライフサイクルまでバラバラにならないよう、Property Inspector（PI）の共通アーキテクチャを定義する。

本資料の目的は、すべてのActionに同一のUIを強制することではない。Action固有の機能や画面構成は維持しつつ、状態の所有権、永続化、初期化、Pluginとの通信境界を統一する。

## 2. 背景と問題

v1.0.xまでの開発では、各PIが個別に発展した結果、Action settingsへの書き込みに次の2経路が混在するケースが生じた。

1. SDPI Componentsの `setting="..."` による自動保存
2. 独自コードによる `getSettings() -> 変更 -> setSettings()`

`setSettings()` は個別フィールドへの原子的なpatchではなく、Action settingsのsnapshot全体を書き戻す。このため、複数のwriterが異なる時点のsnapshotを保持するとLost Updateが発生する。

Infrared Remoteで発生したOperation消失問題では、Operation自体は正常に保存されたにもかかわらず、その直後にSDPI Components側の古いsnapshotによる自動保存が発生し、Operationが空値へ巻き戻された。

また、Promise queueで直列化できるのは、そのqueueを通過するwriterだけである。SDPI Components内部の自動保存まで同じqueueで排他制御することはできない。

## 3. アーキテクチャ原則

### 3.1 PIごとに永続化方式を1種類だけ選択する

各PIは、次のどちらか一方のPersistence Modeを採用する。

#### Simple Mode

フィールド間の連動した原子的更新を必要としない、一般的なフォームに使用する。

- SDPI Componentsの `setting=` をAction settingsのwriterとする。
- 直接の `setSettings()` 呼び出しは禁止する。
- Managed Settings Storeの利用は禁止する。
- `setting=` を持つComponentをプログラムから変更する場合は、SDPI Componentsの永続化ライフサイクルを意図的に利用するものとする。

API Requestを当初のSimple Mode PIとする。

#### Managed Mode

settings間に依存関係がある場合、動的UI、正規化、migration、複数フィールドの原子的更新などが必要な場合に使用する。

- 共通のProperty Inspector Settings StoreをAction settingsの唯一のwriterとする。
- PIのHTMLでは `setting=` および `label-setting=` を禁止する。
- Store外からの `streamDeckClient.setSettings()` 直接呼び出しを禁止する。
- プログラムからのUI更新は永続化を意味しない。
- ユーザー操作はStoreを通して永続化し、その確定stateをUIへrenderする。

Physical Control、Infrared Remote、Get StatusをManaged Modeへ移行する。

### 3.2 UI stateと永続stateを分離する

Managed Modeでは、Componentへの `.value = ...` はUI表示の変更としてのみ扱い、settings保存を期待してはならない。

永続化は明示する。

```ts
await settings.update(current => {
  current.operationId = selectedOperation;
});
```

UIへの反映は別処理とする。

```ts
operation.value = state.operationId;
```

これにより、コードを見ただけで「表示変更」と「永続化」を区別できるようにする。

### 3.3 Action固有ControllerはAction固有のまま維持する

ドメイン上自然に異なる処理まで無理に共通化しない。

例:

- Physical Control: Device -> Operation -> Parameters
- Infrared Remote: Remote -> Operation -> Custom / Channel / AC -> Override
- Get Status: Device -> Status -> Observed Fields -> Template
- API Request: Endpoint -> Device / Scene -> Request Body

共通層では、stateの所有権、永続化、初期化、通信境界を標準化する。

## 4. Managed Settings Store

v1.1では、Managed Mode用の共通Property Inspector Settings Storeを導入する。

従来の `createSettingsPatchQueue()` は、Managed settingsの主要な抽象化としてはSettings Storeへ置き換える。

### Storeの責務

- 現在のAction settingsを読み込む。
- SDKおよびテストで利用される `{ settings: ... }` envelopeを一貫して展開する。
- Actionから渡されたnormalizerによってsettingsを正規化する。
- Managed Modeのすべての書き込みを直列化する。
- 初期化後の最新の正規化stateを保持・参照できるようにする。
- 単一writerとして明示的な更新を行う。
- Plugin側等からの外部変更を再取得する必要がある場合に、明示的なreloadを提供する。
- Action固有Controllerから直接の `getSettings()/setSettings()` を隔離する。

想定API:

```ts
const settings = createPropertyInspectorSettingsStore(
  streamDeckClient,
  normalizeSettings
);

await settings.initialize();

const current = settings.current;

await settings.update(state => {
  state.operationId = "turnOn";
});

await settings.reload();
```

実装時にAPIの細部を調整することは許容する。ただし、**single-writer原則は必須**とする。

## 5. 初期化ライフサイクル

Managed ModeのPIは、原則として次の初期化順序へ統一する。

```text
DOMContentLoaded
  -> Settings Storeをinitialize
  -> 永続settingsをload / normalize
  -> Action固有のCatalog/Dataを初期化
  -> 永続stateをUIへrender
  -> ユーザー操作による更新を有効化
```

非同期Catalog応答によって選択肢を更新することは許容するが、保存済みの選択値を暗黙にfallback値へ置き換えてはならない。

UIのrenderによってSDPI Componentの `valuechange` が発生する場合も、それをユーザー操作としてsettingsへ保存しないよう制御する。

## 6. Plugin通信

v1.1以前に導入したPlugin側のstale response対策を基準とする。

- 要求元Action instanceはSDKイベントの `ev.action.id` から特定する。
- そのActionが現在表示中のPIである場合のみPIへ応答する。
- すでに別Actionへ切り替わっている場合、古い非同期応答は破棄する。

Catalog/message通信の共通化は今後検討可能だが、v1.1のSettings Store導入に合わせて大規模なCatalog Protocolの書き換えまでは行わない。

## 7. 現行PIの分類

| Property Inspector | v1.1 Mode | 方針 |
| --- | --- | --- |
| API Request | Simple | 現状ほぼSDPI Componentsの自動保存に統一されており、Action settingsへの独自 `setSettings()` writerを持たない。 |
| Physical Control | Managed | Device、Operation、Parametersはすでに独自管理。残る `skipUnlockConfirmation` を移行する。 |
| Infrared Remote | Managed | v1.0.1でOperation/OverrideのLost Updateを修正済み。残る自動保存フィールドを共通Storeへ移行する。 |
| Get Status | Managed | `output.*` の自動保存と `output.statusTemplate` の独自更新が混在しており、残存するmixed-writerリスクが最も高い。 |

Authenticationはこの分類から除外する。

Token/SecretはAction settingsではなくPlugin Global Settingsであり、書き込みはすでにPlugin側の `GlobalSettingsStore` を経由している。

## 8. Guardrail

v1.1では、アーキテクチャ違反をCI/static testで検出する。

最低限、次を検査する。

1. Managed ModeのPI HTMLには `setting=` および `label-setting=` が存在してはならない。
2. Managed ModeのControllerから `streamDeckClient.setSettings()` を直接呼び出してはならない。
3. Simple ModeのControllerではManaged Settings Storeを生成・利用してはならない。
4. 一時的な診断ログをrelease用PIコードへ残してはならない。
5. Action settingsへの直接writerは共通Settings Storeへ集約する。

これらはアーキテクチャ違反を防ぐためのguardであり、runtime testの代替ではない。

## 9. テスト方針

### Settings Store単体テスト

最低限、次を検証する。

- initializeとsettings envelopeの展開
- normalization
- 同時updateの直列化
- 常に最新の確定stateを基準にした更新
- write失敗後もqueueが恒久的に停止しないこと
- reload
- 必要に応じ、呼び出し元とStore内部state間でmutationが漏れないこと

### PI Architecture Test

Simple / Managed Modeの制約をstatic testで検証する。

### 実機Acceptance Test

各Managed PIの移行時に最低限次を確認する。

- 新規Actionを作成する。
- 依存関係を持つ設定項目を入力する。
- 別Actionへ切り替えて戻る。
- settingsが復元される。
- Stream Deckを再起動しても復元される。
- 親項目変更時の従属項目resetが正しく動く。
- 実際のキー操作が正常に動作する。

## 10. v1.1移行計画

### PR 1 — Common Settings Store + Architecture Guard

- 本アーキテクチャ契約を追加する。
- 共通Settings Storeを実装する。
- Storeの単体テストを追加する。
- Simple / Managed ModeのArchitecture Guardを追加する。
- 従来の `createSettingsPatchQueue()` の制約を明文化する。

このPRでは各Actionを大規模には変更しない。

### PR 2 — Physical Control移行

- `skipUnlockConfirmation` をManaged writerへ移行する。
- 既存のDevice / Operation / Parameter更新を共通Settings Storeへ移行する。
- Physical ControlからAction settings用の `setting=` を完全に除去する。
- 共通Physical Controlを利用する各カテゴリで回帰確認する。

### PR 3 — Infrared Remote移行

- 残るAction settingsの自動保存フィールドを共通Storeへ移行する。
- v1.0.1で導入したOperation/Overrideのrace対策を維持する。
- Infrared RemoteのAction settingsを完全なsingle-writer構成にする。

### PR 4 — Get Status移行

- `output.*` を含む全Action settingsを共通Storeへ移行する。
- 独自Templateとcaret操作を維持する。
- 自動保存と独自保存の混在を解消する。

### PR 5 — API Request評価

- Managed writerが不要であればSimple Modeを維持する。
- Simple Modeを保証するために必要なguard/testのみ追加する。
- 見た目の統一だけを目的としたリファクタリングは行わない。

## 11. Release Scope

v1.0.1を、本アーキテクチャ変更前の安定版とする。

本資料で定義するアーキテクチャ変更は、複数ActionにまたがるProperty Inspectorの内部状態管理方式を意図的に変更するため、**v1.1.0** を対象とする。

ユーザーから見た機能・操作は原則として維持し、settings永続化raceや初期化順序に起因する不整合のみを修正する。
