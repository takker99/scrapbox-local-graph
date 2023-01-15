import { Page, toTitleLc } from "./deps/scrapbox.ts";
import { LinkData } from "./types.ts";

/** ページデータからリンク及び被リンク構造を計算する
 *
 * @param page 構造を計算したいページのデータ
 * @return link data
 */
export const convert = (page: Page): LinkData => {
  const linkData: LinkData = {
    outgoing: new Map(),
    incoming: new Map(),
    toTitle: new Map(page.links.map((link) => [toTitleLc(link), link])),
  };

  const list = [
    {
      title: page.title,
      titleLc: toTitleLc(page.title),
      linksLc: page.links.map((link) => toTitleLc(link)),
    },
    ...page.relatedPages.links1hop,
    ...page.relatedPages.links2hop,
  ];

  // 順リンク構造と逆リンク構造を一度に作る
  for (const { title, titleLc, linksLc } of list) {
    linkData.outgoing.set(titleLc, linksLc);
    linkData.toTitle.set(titleLc, title);
    for (const link of linksLc) {
      const linkLc = toTitleLc(link);
      const titlesLc = linkData.incoming.get(linkLc) ?? new Set<string>();
      titlesLc.add(titleLc);
      linkData.incoming.set(linkLc, titlesLc);
    }
  }

  return linkData;
};
