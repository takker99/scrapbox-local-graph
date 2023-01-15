/** @jsx h */

import { h, render } from "./deps/preact.tsx";
import { App } from "./App.tsx";

export interface SetupInit {
  /** カスタムCSS
   *
   * インラインCSSとして<style />で読み込む
   */
  style?: string;
}
export interface Operators {
  isOpen: () => boolean;
  open: () => void;
  close: () => void;
}

/** scrapbox-select-suggestionを起動する
 *
 * @param init 初期設定
 * @return いろいろ
 */
export const setup = (init?: SetupInit): Operators => {
  const app = document.createElement("div");
  app.dataset.userscriptName = "scrapbox-local-graph";
  const shadowRoot = app.attachShadow({ mode: "open" });
  const relatedPages = document.querySelector(".related-page-list")!;
  relatedPages.parentNode!.insertBefore(app, relatedPages);

  render(<App css={init?.style ?? ""} />, shadowRoot);

  return {
    open: () => {
      app.hidden = false;
    },
    close: () => {
      app.hidden = true;
    },
    isOpen: () => !app.hidden,
  };
};
