import assert from "node:assert/strict";
import test from "node:test";

import {
  hasTimedLyricLines,
  normalizeLyricText,
  parseLyricText,
  pickPrimaryLyricText,
} from "./localLyrics";

test("parseLyricText keeps plain local lyrics visible when no timestamps exist", () => {
  const lines = parseLyricText("第一句\n\n第二句  \n第三句");

  assert.deepEqual(lines, [
    { time: null, text: "第一句" },
    { time: null, text: "第二句" },
    { time: null, text: "第三句" },
  ]);
  assert.equal(hasTimedLyricLines(lines), false);
});

test("parseLyricText parses timed lrc lines and merges duplicate timestamps into translation", () => {
  const lines = parseLyricText("[00:01.20]Hello\n[00:01.20]你好\n[00:03.05]World");

  assert.deepEqual(lines, [
    { time: 1.2, text: "Hello", translation: "你好" },
    { time: 3.05, text: "World" },
  ]);
  assert.equal(hasTimedLyricLines(lines), true);
});

test("pickPrimaryLyricText removes duplicates and keeps normalized line breaks", () => {
  const lyricText = pickPrimaryLyricText([
    "\uFEFF[00:01.00]Line one\r\n[00:02.00]Line two",
    "[00:01.00]Line one\n[00:02.00]Line two",
    " ",
  ]);

  assert.equal(
    lyricText,
    "[00:01.00]Line one\n[00:02.00]Line two",
  );
  assert.equal(normalizeLyricText("\uFEFFA\r\nB"), "A\nB");
});
