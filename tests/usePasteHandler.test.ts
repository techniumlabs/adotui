import { expect, test } from "bun:test";
import { splitPastes } from "../src/app/hooks/usePasteHandler";

const S = "\x1b[200~";
const E = "\x1b[201~";
const fresh = { isPasting: false, buffer: "" };

test("typed input passes through untouched", () => {
  expect(splitPastes("abc", fresh)).toEqual({ isPasting: false, buffer: "", clean: "abc", pasted: [] });
});

test("a paste is cut out of the typed input around it", () => {
  expect(splitPastes(`x${S}hello 1${E}y`, fresh)).toEqual({ isPasting: false, buffer: "", clean: "xy", pasted: ["hello 1"] });
});

test("a paste split across chunks is carried over and delivered once", () => {
  const first = splitPastes(`a${S}hel`, fresh);
  expect(first).toEqual({ isPasting: true, buffer: "hel", clean: "a", pasted: [] });
  const second = splitPastes("lo", first);
  expect(second).toEqual({ isPasting: true, buffer: "hello", clean: "", pasted: [] });
  expect(splitPastes(`!${E}z`, second)).toEqual({ isPasting: false, buffer: "", clean: "z", pasted: ["hello!"] });
});

test("two pastes in one chunk", () => {
  expect(splitPastes(`${S}one${E}-${S}two${E}`, fresh).pasted).toEqual(["one", "two"]);
});
