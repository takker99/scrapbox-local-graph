/** グラフ描画に使うデータ */
export interface LinkData {
  /** incoming links (逆リンク)
   *
   * keyはtilteLc形式
   */
  incoming: Map<string, Set<string>>;

  /** outgoing links (順リンク)
   *
   * keyはtilteLc形式
   */
  outgoing: Map<string, string[]>;

  /** titleLcからtitleへのmap */
  toTitle: Map<string, string>;
}
