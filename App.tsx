/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="dom" />
/** @jsx h */
/** @jsxFrag Fragment */

import {
  Fragment,
  h,
  useCallback,
  useEffect,
  useState,
} from "./deps/preact.tsx";

import { LinkData } from "./types.ts";
import { Graph } from "./Graph.tsx";
import { convert } from "./convert.ts";
import { findLatestCache, getPage, Scrapbox } from "./deps/scrapbox.ts";
declare const scrapbox: Scrapbox;

export interface AppProps {
  css: string;
}

/** 指定した要素にlocal graphを描画する
 */
export const App = (props: AppProps) => {
  const [linkData, setLinkData] = useState<LinkData | undefined>();

  const callback = useCallback(async () => {
    setLinkData(undefined);
    if (scrapbox.Layout !== "page") {
      return;
    }

    // データをcache-firstで取得する
    const req = getPage.toRequest(scrapbox.Project.name, scrapbox.Page.title);
    const res = await findLatestCache(req, { ignoreSearch: true }) ??
      await fetch(req);
    const result = await getPage.fromResponse(res);
    if (!result.ok) {
      setLinkData(undefined);
      return;
    }
    const page = result.value;

    // データを整形して描画する
    setLinkData(convert(page));
  }, []);

  useEffect(() => {
    callback();

    scrapbox.addListener("layout:changed", callback);
    scrapbox.addListener("page:changed", callback);

    return () => {
      scrapbox.removeListener("layout:changed", callback);
      scrapbox.removeListener("page:changed", callback);
    };
  }, [callback]);

  return linkData ? <Graph css={props.css} linkData={linkData} /> : <></>;
};
