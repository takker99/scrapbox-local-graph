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
  useMemo,
  useRef,
  useState,
} from "./deps/preact.tsx";
import {
  D3DragEvent,
  D3ZoomEvent,
  drag,
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  select,
  SimulationNodeDatum,
  zoom,
} from "./deps/d3.ts";
import { LinkData } from "./types.ts";
import { Scrapbox, toTitleLc } from "./deps/scrapbox.ts";
declare const scrapbox: Scrapbox;

interface Node extends SimulationNodeDatum {
  titleLc: string;
}
interface Link {
  index?: number;
  source: Node | string;
  target: Node | string;
}
interface Data {
  nodes: Node[];
  links: Link[];
}

// パラメタはblu3mo-quartzを流用
const repelForce = 0.7;
const opacityScale = 5;
const scale = 1.2;
const fontSize = 0.7;

export interface GraphProps {
  linkData: LinkData;
  css: string;
}

export const Graph = (props: GraphProps) => {
  const { incoming, outgoing } = props.linkData;
  const [hoverCSS, setHoverCSS] = useState("");

  const data: Data = useMemo(() => ({
    nodes: [...new Set([...incoming.keys(), ...outgoing.keys()])].map((
      titleLc,
    ) => ({ titleLc })),
    links: [...outgoing.entries()].flatMap(([titleLc, linksLc]) =>
      linksLc.map((linkLc) => ({ source: titleLc, target: linkLc }))
    ),
  }), [incoming, outgoing]);

  const svgEl = useRef<SVGSVGElement>(null);

  const [transform, setTransform] = useState("");

  /** calculate radius */
  const nodeRadius = useCallback((d: Node): number => {
    const numOut = outgoing.get(d.titleLc)?.length ?? 0;
    const numIn = incoming.get(d.titleLc)?.size ?? 0;
    return 2 + Math.sqrt(numOut + numIn);
  }, [incoming, outgoing]);

  useEffect(() => {
    if (!svgEl.current) return;
    const svg = select(svgEl.current);

    const nodes: Node[] = structuredClone(data.nodes);
    const links: Link[] = structuredClone(data.links);

    const simulation = forceSimulation<Node, Link>(nodes)
      .force(
        "link",
        forceLink<Node, Link>(links)
          .id((d) => d.titleLc)
          .distance(50),
      )
      .force("charge", forceManyBody().strength(-100 * repelForce))
      .force("center", forceCenter());

    type DEvent = D3DragEvent<SVGGElement, Node, SVGGElement>;

    svg.selectAll<SVGGElement, Node>("g.node").data(nodes).call(
      drag<SVGGElement, Node>()
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
        }),
    );
    svg.selectAll("g.link").data(links);

    const zoom_ = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on("zoom", ({ transform }: D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform(transform.toString());
      });
    svg.call(zoom_);

    // progress the simulation
    simulation.on("tick", () => {
      // 一つの属性だけで位置を決めたいので、<line>の代わりに<path>を使った
      svg.selectAll<SVGPathElement, Link>("path").attr("d", (_, i) => {
        const source = links[i].source as Node;
        const target = links[i].target as Node;
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
      svg.selectAll<SVGCircleElement, Node>("circle").attr(
        "cx",
        (_, i) => nodes[i].x ?? null,
      ).attr("cy", (_, i) => nodes[i].y ?? null);
      svg.selectAll<SVGTextElement, Node>("text").attr(
        "x",
        (_, i) => nodes[i].x ?? null,
      )
        .attr(
          "y",
          (_, i) => nodes[i].y ?? null,
        );
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
      const rect = svgEl.current.getBoundingClientRect();
      handleResize(rect.width, rect.height);
    }
    const observer = new ResizeObserver(
      ([{ contentRect }]) =>
        handleResize(contentRect.width, contentRect.height),
    );
    observer.observe(svgEl.current);
    return () => {
      simulation.stop();
      observer.disconnect();
    };
  }, [svgEl.current, data]);

  return (
    <>
      <style>
        {`svg {
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
  --graph-node-font-size: 0.7em;
  --graph-link: #f2f2f3;
  --graph-link-active: #848484;
  --graph-label-color: var(--page-text-color, #4a4a4a);
  --graph-node-opacity-factor: 1.0;
}
.node {
  opacity: calc(var(--graph-node-opacity-factor) * 1.0);
  transition: opacity 0.2s linear;
}
.node.empty{
  opacity: calc(var(--graph-node-opacity-factor) * 0.5);
}
circle {
  fill: var(--graph-node);
  cursor: pointer;
}
.current circle {
  fill: var(--graph-node-current);
}
.link {
  color: var(--graph-link);
}
text {
  font-size: var(--graph-node-font-size);
  fill: var(--graph-label-color);
}
text, .link {
  transition: color,font-size;
  transition-duration: 0.2s;
  transition-timing-function: linear;
}`}
      </style>
      <style>{props.css}</style>
      <style>{hoverCSS}</style>
      <svg ref={svgEl}>
        <defs>
          <polygon id="arrow" points="0,0 10,5, 0,10 5,5" />
        </defs>
        <g transform={transform}>
          {data.links.map((link, i) => (
            <Link
              key={`${link.source}-${link.target}`}
              source={link.source as string}
              target={link.target as string}
              index={i}
            />
          ))}
          {data.nodes.map((node) => (
            <NodeComponent
              node={node}
              changeCSS={setHoverCSS}
              {...props.linkData}
            />
          ))}
        </g>
      </svg>
    </>
  );
};

const hoverStyle = (d: Node, opacity: number) => {
  const titleLc = CSS.escape(d.titleLc);
  return `.node:not([data-title="${titleLc}"]):not([data-targets*="\\"${titleLc}\\""]):not([data-sources*="\\"${titleLc}\\""]) {
  --graph-node-opacity-factor: 0.6;
}
.node[data-title="${titleLc}"] text {
  opacity: 1 !important;
  font-size: calc(var(--graph-node-font-size) * 1.5) !important;
}
.link:is([data-target="${titleLc}"], [data-source="${titleLc}"]) {
  color: var(--graph-link-active);
}`;
};

const Link = (props: { source: string; target: string; index: number }) => (
  <g
    className="link"
    data-source={props.source}
    data-target={props.target}
  >
    <marker
      id={`m${props.index}`}
      viewBox="0 0 10 10"
      refX={8}
      refY={5}
      marker-width={4}
      marker-height={4}
      orient="auto"
    >
      <use xlinkHref="#arrow" fill="currentColor" />
    </marker>
    <path
      stroke="currentColor"
      stroke-width={2}
      marker-end={`url(#m${props.index})`}
    />
  </g>
);

const NodeComponent = (
  props: {
    node: Node;
    changeCSS: (css: string) => void;
  } & LinkData,
) => {
  const { node, changeCSS, outgoing, incoming, toTitle } = props;

  const isCurrent = useMemo(
    () =>
      scrapbox.Layout === "page"
        ? toTitleLc(scrapbox.Page.title) === node.titleLc
        : "" === node.titleLc,
    [node.titleLc],
  );

  /** calculate radius */
  const nodeRadius = useCallback((d: Node): number => {
    const numOut = outgoing.get(d.titleLc)?.length ?? 0;
    const numIn = incoming.get(d.titleLc)?.size ?? 0;
    return 2 + Math.sqrt(numOut + numIn);
  }, [incoming, outgoing]);

  const isEmpty = useCallback((titleLc: string) => {
    const incomingCount = incoming.get(titleLc)?.size ?? 0;
    const outgoingCount = outgoing.get(titleLc)?.length ?? 0;
    return incomingCount < 2 && outgoingCount === 0;
  }, [incoming, outgoing]);

  const className = useMemo(() => {
    const classList: string[] = ["node"];
    if (isCurrent) classList.push("current");
    if (isEmpty(node.titleLc)) classList.push("empty");
    return classList.join(" ");
  }, [isCurrent, node.titleLc]);

  const handleOver = useCallback(
    () => changeCSS(hoverStyle(node, opacityScale)),
    [changeCSS, node, opacityScale],
  );
  const handleLeave = useCallback(() => changeCSS(""), [changeCSS]);

  return (
    <g
      className={className}
      data-title={node.titleLc}
      data-targets={JSON.stringify(outgoing.get(node.titleLc) ?? [])}
      data-sources={JSON.stringify([
        ...(incoming.get(node.titleLc) ?? []),
      ])}
    >
      {/** @ts-ignore たぶんSVGAnchorElementになってくれるはず */}
      <a xlinkHref={`/${scrapbox.Project.name}/${node.titleLc}`}>
        <circle
          r={nodeRadius(node)}
          onMouseOver={handleOver}
          onMouseLeave={handleLeave}
        />
      </a>
      <text
        dx={0}
        dy={"8px"}
        text-anchor="middle"
        dominant-baseline="text-before-edge"
        style={{ opacity: opacityScale, "pointer-events": "none" }}
      >
        {toTitle.get(node.titleLc) ?? node.titleLc}
      </text>
    </g>
  );
};
