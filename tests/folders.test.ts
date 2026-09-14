import { describe, expect, test } from "bun:test";
import { pickDefaultFolder, resolveIngestFolders } from "@/lib/folders";
import type { FavFolder } from "@/lib/types";

function folder(urlToken: string, title: string): FavFolder {
  return { urlToken, url: "", title, description: "", isPublic: true };
}

const folders = [folder("a", "读书"), folder("b", "默认收藏夹"), folder("c", "工作")];

describe("pickDefaultFolder", () => {
  test("优先标题为默认收藏夹", () => {
    expect(pickDefaultFolder(folders)?.urlToken).toBe("b");
  });
  test("没有默认收藏夹时用第一项", () => {
    expect(pickDefaultFolder([folder("a", "读书"), folder("c", "工作")])?.urlToken).toBe("a");
  });
  test("空列表返回 undefined", () => {
    expect(pickDefaultFolder([])).toBeUndefined();
  });
});

describe("resolveIngestFolders", () => {
  test("未选任何夹时只拉默认收藏夹", () => {
    expect(resolveIngestFolders(folders, []).map((f) => f.urlToken)).toEqual(["b"]);
    expect(resolveIngestFolders(folders, undefined).map((f) => f.urlToken)).toEqual(["b"]);
  });
  test("选了夹就按选择拉", () => {
    expect(resolveIngestFolders(folders, ["c", "a"]).map((f) => f.urlToken)).toEqual(["a", "c"]);
  });
  test("选择无效时回退默认", () => {
    expect(resolveIngestFolders(folders, ["nope"]).map((f) => f.urlToken)).toEqual(["b"]);
  });
});
