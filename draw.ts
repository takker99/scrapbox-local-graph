/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="dom" />

import {
  D3DragEvent,
  D3ZoomEvent,
  drag,
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  select,
  SimulationLinkDatum,
  SimulationNodeDatum,
  zoom,
} from "./deps/d3.ts";
import { LinkData } from "./types.ts";
import { Scrapbox, toTitleLc } from "./deps/scrapbox.ts";
declare const scrapbox: Scrapbox;

interface Node extends SimulationNodeDatum {
  titleLc: string;
}
type Link = SimulationLinkDatum<Node>;
interface Data {
  nodes: Node[];
  links: Link[];
}

// パラメタはblu3mo-quartzを流用
const repelForce = 0.7;
const opacityScale = 5;
const scale = 1.2;
const fontSize = 0.7;

export interface Graph {
  container: HTMLDivElement;

  /** グラフを描画する
   *
   * すでに描画されているときは、新しいデータで更新する
   * @param linkData
   */
  render: (linkData: LinkData) => void;

  /** 描画を終了する */
  dispose: () => void;
}

/** 新しいグラフを作成する
 *
 * @param css graphに与えるスタイル
 * @return 描画や後始末函数など
 */
export const makeGraph = (css: string): Graph => {
  // 描画領域を作成する
  const root = document.createElement("div");
  root.id = "root";
  const container = document.createElement("div");
  const customStyle = document.createElement("style");

  {
    const shadowRoot = container.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `#root {
  width: 100%;
  min-height: 250px;
  box-shadow: 0 4px 0 rgba(0,0,0,.16);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
  background-color: var(--page-bg, #fefefe);
  margin: .5em 0;
  --graph-node: #6b879a;
  --graph-node-current: #f58382;
  --graph-node-inactive: #4a575e;
  --graph-link: #f2f2f3;
  --graph-link-active: #848484;
  --graph-label-color: var(--page-text-color, #4a4a4a);
}
circle {
  fill: var(--graph-node);
  cursor: pointer;
  opacity: 1.0;
  transition: opacity 0.1s linear;
}
.current circle {
  fill: var(--graph-node-current);
}
.empty circle {
  opacity: 0.5;
}
.link {
  color: var(--graph-link);
}
text {
  font-size: ${fontSize}em;
}
text, .link {
  transition: color,font-size,opacity;
  transition-duration: 0.2s;
  transition-timing-function: linear;
}
${css}`;
    shadowRoot.appendChild(style);
    shadowRoot.appendChild(customStyle);
    shadowRoot.appendChild(root);
  }

  let cleanup = () => {};
  return {
    container,
    render: (linkData) => {
      cleanup = render(root, customStyle, linkData);
    },
    dispose: () => {
      cleanup();
    },
  };
};

const render = (
  container: HTMLDivElement,
  customStyle: HTMLStyleElement,
  linkData: LinkData,
): () => void => {
  const { incoming, outgoing, toTitle } = linkData;

  const data: Data = {
    nodes: [...new Set([...incoming.keys(), ...outgoing.keys()])].map((
      titleLc,
    ) => ({ titleLc })),
    links: [...outgoing.entries()].flatMap(
      ([titleLc, linksLc]) =>
        linksLc.map((linkLc) => ({ source: titleLc, target: linkLc })),
    ),
  };

  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const svg = select(container).append(() => svgEl);

  /** calculate radius */
  const nodeRadius = (d: Node): number => {
    const numOut = outgoing.get(d.titleLc)?.length ?? 0;
    const numIn = incoming.get(d.titleLc)?.size ?? 0;
    return 2 + Math.sqrt(numOut + numIn);
  };

  const simulation = forceSimulation<Node, Link>(data.nodes)
    .force(
      "link",
      forceLink<Node, Link>(data.links)
        .id((d) => d.titleLc)
        .distance(50),
    )
    .force("charge", forceManyBody().strength(-100 * repelForce))
    .force("center", forceCenter());

  const drag_ = <T extends Element>() => {
    type DEvent = D3DragEvent<T, Node, SVGGElement>;

    return drag<T, Node>()
      .on(
        "start",
        (event: DEvent, d) => {
          if (!event.active) simulation.alphaTarget(1).restart();
          d.fx = d.x;
          d.fy = d.y;
        },
      )
      .on("drag", (event: DEvent, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event: DEvent, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });
  };

  // 矢印を作る
  svg.append("svg:defs")
    .append("polygon")
    .attr("id", "arrow")
    .attr("points", "0,0 10,5, 0,10 5,5");

  // draw links between nodes
  const linksGroup = svg
    .append("g")
    .selectAll("g")
    .data(data.links)
    .join("g")
    .classed("link", true)
    .attr("data-target", (d) => (d.target as Node).titleLc)
    .attr("data-source", (d) => (d.source as Node).titleLc);
  linksGroup.append("svg:marker")
    .attr("id", (_, i) => `m${i}`)
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8)
    .attr("refY", 5)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("use")
    .attr("xlink:href", "#arrow")
    .attr("fill", "currentColor");
  const links = linksGroup.append("path")
    .attr("stroke", "currentColor")
    .attr("stroke-width", 2)
    // 双方向リンクの場合は、各方向の矢印が2本重なって双方向に見える
    .attr("marker-end", (_, i) => `url(#m${i})`);

  // svg groups
  const currentTitleLc = scrapbox.Layout === "page"
    ? toTitleLc(scrapbox.Page.title)
    : "";
  const graphNode = svg
    .append("g")
    .selectAll("g")
    .data(data.nodes)
    .enter().append("g")
    .classed("node", true)
    .classed("current", (d) => d.titleLc === currentTitleLc)
    .classed("empty", (d) => {
      const incomingCount = incoming.get(d.titleLc)?.size ?? 0;
      const outgoingCount = outgoing.get(d.titleLc)?.length ?? 0;
      return incomingCount < 2 && outgoingCount === 0;
    })
    .attr("data-title", (d) => d.titleLc)
    .attr("data-targets", (d) => JSON.stringify(outgoing.get(d.titleLc) ?? []))
    .attr(
      "data-sources",
      (d) => JSON.stringify([...(incoming.get(d.titleLc) ?? [])]),
    );

  /** ラベルの透明度 */
  let scaledOpacity = 1;

  // draw individual nodes
  const nodes = graphNode
    .append("a")
    .attr("xlink:href", (d) => `/${scrapbox.Project.name}/${d.titleLc}`)
    .call(drag_())
    .append("circle")
    .attr("r", nodeRadius)
    .on("mouseover", (_, d) => {
      customStyle.textContent = hoverStyle(d, scaledOpacity);
    })
    .on("mouseleave", () => {
      customStyle.textContent = "";
    });

  // draw labels
  const labels = graphNode
    .append("text")
    .attr("dx", 0)
    .attr("dy", "8px")
    .attr("text-anchor", "middle").attr("dominant-baseline", "text-before-edge")
    .attr("fill", "var(--graph-label-color)")
    .text((d) => (toTitle.get(d.titleLc) ?? d.titleLc))
    .style("opacity", scaledOpacity)
    .style("pointer-events", "none")
    .raise()
    .call(drag_());

  const zoom_ = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.25, 4])
    .on("zoom", ({ transform }: D3ZoomEvent<SVGSVGElement, unknown>) => {
      links.attr("transform", transform.toString());
      nodes.attr("transform", transform.toString());
      const scale = transform.k * opacityScale;
      // 縮尺が小さいほど薄くなる
      scaledOpacity = Math.min(Math.max((scale - 1) / 3.75, 0), 1);
      labels.attr("transform", transform.toString()).style(
        "opacity",
        scaledOpacity,
      );
    });
  svg.call(zoom_);

  // progress the simulation
  simulation.on("tick", () => {
    // 一つの属性だけで位置を決めたいので、<line>の代わりに<path>を使った
    links.attr("d", (d) => {
      const source = d.source as Node;
      const target = d.target as Node;
      const x1 = source.x ?? 0;
      const y1 = source.y ?? 0;
      const x2 = target.x ?? 0;
      const y2 = target.y ?? 0;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dr = (dx ** 2 + dy ** 2) ** 0.5;
      const r1 = nodeRadius(source);
      const r2 = nodeRadius(target);

      // Nodeの半径の分だけ始点と終点をずらす
      return `M${x1 + (dx / dr) * r1},${y1 + (dy / dr) * r1}L${
        x2 - (dx / dr) * r2
      },${y2 - (dy / dr) * r2}`;
    });
    nodes.attr("cx", (d) => d.x ?? null).attr("cy", (d) => d.y ?? null);
    labels.attr("x", (d) => d.x ?? null).attr("y", (d) => d.y ?? null);
  });

  const handleResize = (width: number, height: number) => {
    svg.attr(
      "viewBox",
      `${-width / 2 * 1 / scale} ${-height / 2 * 1 / scale} ${
        width * 1 / scale
      } ${height * 1 / scale}`,
    );
    zoom_.extent();
  };
  {
    const rect = svgEl.getBoundingClientRect();
    handleResize(rect.width, rect.height);
  }
  const observer = new ResizeObserver(
    ([{ contentRect }]) => handleResize(contentRect.width, contentRect.height),
  );
  observer.observe(svgEl);

  return () => {
    simulation.stop();
    observer.disconnect();
    container.textContent = "";
  };
};

const hoverStyle = (d: Node, opacity: number) =>
  `.node:not([data-title="${d.titleLc}"]):not([data-targets*="\\"${d.titleLc}\\""]):not([data-sources*="\\"${d.titleLc}\\""]) circle {
  opacity: 0.6;
}
.node.empty:not([data-title="${d.titleLc}"]):not([data-targets*="\\"${d.titleLc}\\""]):not([data-sources*="\\"${d.titleLc}\\""]) circle {
  opacity: 0.3;
}
.node:not([data-title="${d.titleLc}"]):not([data-targets*="\\"${d.titleLc}\\""]):not([data-sources*="\\"${d.titleLc}\\""]) text {
  opacity: ${opacity * 0.6} !important;
}
.node[data-title="${d.titleLc}"] text {
  opacity: 1 !important;
  font-size: ${fontSize * 1.5}em !important;
}
.link:is([data-target="${d.titleLc}"], [data-source="${d.titleLc}"]) {
  color: var(--graph-link-active);
}`;
