# Asset sources and redistribution notes

Prepared for the v96 source handoff, reviewed 2026-10-12. This records component terms; it does **not** choose a license for the application or grant rights to other people's assets. No upload was performed. Preserve the existing notices below.

### Runtime libraries

- **Three.js r180**: `dist/vendor/three.core.js`, `three.module.js`, and the Three.js `OrbitControls.js` addon. MIT permits source redistribution with the copyright and permission notices. Keep `dist/vendor/THREE-LICENSE.txt` and embedded notices. The core identifies revision 180; this audit did not byte-compare all vendored Three files to upstream. [Official r180 license](https://raw.githubusercontent.com/mrdoob/three.js/r180/LICENSE)
- **SheetJS Community Edition 0.20.3**: `dist/vendor/xlsx-0.20.3.mjs`. Apache-2.0 permits source redistribution subject to its conditions. Keep `SHEETJS-LICENSE.txt`, `EXCEL-VENDOR-NOTICE.txt`, embedded copyright notices, and any applicable upstream attribution. The existing notice records an unmodified official distribution; its module/license SHA-256 values match the present files. If changed later, mark the modifications. The packaged license includes SheetJS's copyright and short-form license notice; the inventory should link readers to it. [Official CE licensing guidance](https://docs.sheetjs.com/docs/miscellany/license/)
- **fflate 0.8.3**: `dist/vendor/fflate-0.8.3.mjs`. MIT; keep `FFLATE-LICENSE.txt`, the original source comments, and `EXCEL-VENDOR-NOTICE.txt`. Both module and license hashes match that recorded notice. [Official license](https://github.com/101arrowz/fflate/blob/master/LICENSE)

These component licenses do not automatically license the rest of the application.

### Blackboard/countdown glyphs

`dist/board-glyphs.js` contains a reusable subset of Noto Sans CJK SC Bold outlines converted to JavaScript. All 29 outlines match the installed Noto Sans CJK SC Bold 2.004 font exactly. The font metadata identifies:

© 2014-2021 Adobe (http://www.adobe.com/).

Keep these derived outline data under SIL Open Font License 1.1, together with the copyright and license notices. Describe them as a converted subset; do not present them as an unmodified complete upstream font. Retain `dist/board-glyphs-LICENSE.txt` and the supplementary actual-font copyright/provenance in `docs/board-glyphs-SOURCE.txt`. That existing file is a Debian package-level notice whose font copyright entry lists Google 2010-2012; it does not capture the actual font's Adobe metadata. Its GPL section is explicitly scoped to `debian/*`, not to the glyph data or the whole application. Do not remove historical notices or add a project-wide GPL label on that basis. [Upstream OFL](https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/LICENSE) · [OFL guidance on modified/subset fonts](https://openfontlicense.org/ofl-faq/)

### Character models and morphs

`dist/models/*.scene.json` and `relaxed-hand-morphs.json` were made and refined for this project through a local procedural geometry/Blender workflow at the project owner's request. Conversion hashes and runtime geometry are preserved; private authoring paths are removed in this source handoff. These assets are included as project materials. No separate public-domain, MIT, CC0, or other open-source asset license is asserted by this document.

### User-provided roll-call audio

The project owner provided `566-preview.mp3` on 2026-10-12, stated that it was their original work, and authorized use in this project and source handoff. It is included as `dist/audio/rollcall-drum.mp3`. The original MP3 bytes and embedded metadata are retained; only the local filename/reference is changed. See `dist/audio/LICENSE.txt` for the scope of this notice. This does not grant a new open-source license or general permission for third parties to redistribute the recording. Existing playback/excerpt processing is unchanged; the rename is not a claim of a new audible effect.
