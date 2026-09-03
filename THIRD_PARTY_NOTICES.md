# Third-Party Notices

本仓库包含一个基于桌游 SCOUT 规则制作的非官方粉丝实现。

- **SCOUT** 的名称、原作游戏设计、角色及相关商标属于其各自权利人。本项目不主张对这些内容拥有权利，也不代表或暗示获得 Oink Games 的官方认可。
- 仓库内的 Alfa Slab One 与 Rye 字体文件属于第三方字体素材，适用其各自的上游许可条款。
- 根目录 `LICENSE` 中的 MIT License 仅适用于本项目贡献者原创编写的程序源代码，不自动覆盖上述名称、设计、字体或其他第三方内容。

如你是相关权利人并认为仓库中的内容需要调整，请通过 GitHub 联系仓库维护者。

## 音效：Kenney（CC0 1.0）

- `src/assets/audio/select.wav`：用户选择的 A1，来自 [Interface Sounds 1.0](https://kenney.nl/assets/interface-sounds) 的 `Audio/click_001.ogg`，作者 Kenney。
- `src/assets/audio/play.wav`：用户选择的 B1，来自 [Casino Audio 1.1](https://kenney.nl/assets/casino-audio) 的 `Audio/card-place-1.ogg`，作者 Kenney Vleugels。
- 两段原声转换为 44.1 kHz / 16-bit PCM WAV，保留时长、声道和音高。游戏播放增益为 0.5（约降低 6 dB），与试听音量一致；没有添加重复、混响或背景音乐。
- 授权为 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，允许个人和商业使用，不强制署名；并不代表作者为本游戏背书。包内授权原文保存在 `docs/licenses/kenney-interface-sounds.txt` 与 `docs/licenses/kenney-casino-audio.txt`。
