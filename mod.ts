/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="dom" />

import { makeGraph } from "./draw.ts";
import { convert } from "./convert.ts";
import { findLatestCache, getPage, Scrapbox } from "./deps/scrapbox.ts";
declare const scrapbox: Scrapbox;

/** 指定した要素にlocal graphを描画する
 *
 * @param root graphの描画先要素
 * @param css UserCSS
 * @return 後始末函数
 */
export const render = (root: Element, css = ""): () => void => {
  const { container, render, dispose } = makeGraph(css);
  root.append(container);

  const callback = async () => {
    dispose();
    if (scrapbox.Layout !== "page") return;

    // データをcache-firstで取得する
    const req = getPage.toRequest(scrapbox.Project.name, scrapbox.Page.title);
    const res = await findLatestCache(req, { ignoreSearch: true }) ??
      await fetch(req);
    const result = await getPage.fromResponse(res);
    if (!result.ok) return;
    const page = result.value;

    // データを整形して描画する
    render(convert(page));
  };

  callback().then(() => {
    scrapbox.addListener("layout:changed", callback);
    scrapbox.addListener("page:changed", callback);
  });

  return () => {
    dispose();
    scrapbox.removeListener("layout:changed", callback);
    scrapbox.removeListener("page:changed", callback);
    container.remove();
  };
};
