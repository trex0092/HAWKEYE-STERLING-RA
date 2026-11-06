#!/usr/bin/env python3
"""Related-party graph report: EXPERIMENTAL, shadow-only, standard library only.

The live check (ai.related_parties) lists pairs: a person who owns more than one
customer, or an owner who is also a customer. It cannot show a chain: A and B
share an owner, B and C share another, so A, B and C are one network, and a
flagged A is two steps from C. This script builds the whole graph (customers and
individuals as nodes, "owns / controls" as links) and reports:

  * connected networks (every customer reachable from every other through owners),
  * for each flagged customer, every other customer within MAX_HOPS steps, with
    the path that links them.

It is the question networkx would answer (candidate note row 20), answered with a
short breadth-first search so no dependency is added. Nothing here changes
screening, cases or Asana. A link is a lead for the MLRO, never a finding.

Usage: python3 scripts/related-party-graph.py [book.json] [max_hops]
"""
import json
import re
import sys
import unicodedata
from collections import deque

MAX_HOPS = 4          # path length counted in links; customer-owner-customer is 2


def fold(s):
    """Identical to ai._ascii_fold, so this report and the live related-party check
    agree on whether two names are the same person. Upper-case BEFORE decomposing
    (Turkish dotless i), drop accents, keep ASCII letters and digits only. A name
    written wholly in another script folds to nothing and is not linked, exactly as
    in the live check."""
    s = unicodedata.normalize("NFD", str(s or "").upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9 ]", " ", s)).strip().lower()


def build_graph(customers):
    """Returns (adjacency, labels). Nodes are folded names; labels map a folded
    name back to the name as recorded. A name shorter than 5 characters is not
    linked, matching ai.related_parties, so a short string cannot join networks."""
    adj, labels = {}, {}
    def link(a, b):
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)
    for c in customers:
        cn = fold(c.get("name", ""))
        if not cn:
            continue
        labels.setdefault(cn, c.get("name", ""))
        adj.setdefault(cn, set())
        for ind in c.get("individuals") or []:
            k = fold(ind)
            if len(k) < 5:
                continue
            labels.setdefault(k, ind)
            link(cn, k)
    return adj, labels


def components(adj):
    seen, out = set(), []
    for start in sorted(adj):
        if start in seen:
            continue
        comp, queue = [], deque([start])
        seen.add(start)
        while queue:
            n = queue.popleft()
            comp.append(n)
            for m in sorted(adj[n]):
                if m not in seen:
                    seen.add(m)
                    queue.append(m)
        out.append(sorted(comp))
    return out


def paths_from(adj, source, max_hops=MAX_HOPS):
    """Shortest path from source to every node within max_hops links."""
    if source not in adj:
        return {}
    prev, depth, queue = {source: None}, {source: 0}, deque([source])
    while queue:
        n = queue.popleft()
        if depth[n] == max_hops:
            continue
        for m in sorted(adj[n]):
            if m not in prev:
                prev[m], depth[m] = n, depth[n] + 1
                queue.append(m)
    result = {}
    for node in prev:
        if node == source:
            continue
        path, cur = [], node
        while cur is not None:
            path.append(cur)
            cur = prev[cur]
        result[node] = path[::-1]
    return result


def analyse(book, max_hops=MAX_HOPS):
    customers = book.get("customers") or []
    adj, labels = build_graph(customers)
    customer_keys = {fold(c.get("name", "")) for c in customers if fold(c.get("name", ""))}
    networks = []
    for comp in components(adj):
        members = [labels[k] for k in comp if k in customer_keys]
        if len(members) > 1:
            networks.append({"customers": sorted(members),
                             "linking_individuals": sorted(labels[k] for k in comp if k not in customer_keys)})
    flagged_links = []
    for name in book.get("flagged") or []:
        key = fold(name)
        reach = paths_from(adj, key, max_hops)
        for node, path in sorted(reach.items(), key=lambda kv: (len(kv[1]), kv[0])):
            if node in customer_keys:
                flagged_links.append({"flagged": labels.get(key, name), "customer": labels[node],
                                      "links": len(path) - 1,
                                      "path": [labels[p] for p in path]})
    return {"customers": len(customers), "networks": networks, "flagged_links": flagged_links}


def render(result, max_hops=MAX_HOPS):
    L = ["# Related-party graph report (experimental, shadow-only)", "",
         "Customers and their owners are linked as a graph. A link is a lead for the MLRO to "
         "investigate, never a finding. No data leaves the runner and screening is unchanged.", "",
         f"Customers read: {result['customers']}", "",
         f"## Networks (two or more customers joined through owners): {len(result['networks'])}", ""]
    for i, n in enumerate(result["networks"], 1):
        L.append(f"{i}. {', '.join(n['customers'])}  (joined through: {', '.join(n['linking_individuals']) or 'a customer that is also an owner'})")
    if not result["networks"]:
        L.append("None.")
    L += ["", f"## Customers within {max_hops} links of a flagged customer: {len(result['flagged_links'])}", ""]
    for f in result["flagged_links"]:
        L.append(f"- {f['flagged']} to {f['customer']}: {f['links']} link{'' if f['links'] == 1 else 's'} via " + " > ".join(f["path"]))
    if not result["flagged_links"]:
        L.append("None.")
    L.append("")
    return "\n".join(L)


def main(argv):
    path = argv[1] if len(argv) > 1 else "test/fixtures/related-party-graph/book.json"
    hops = int(argv[2]) if len(argv) > 2 else MAX_HOPS
    with open(path, encoding="utf-8") as f:
        book = json.load(f)
    md = render(analyse(book, hops), hops)
    with open("related-party-graph-report.md", "w", encoding="utf-8") as f:
        f.write(md)
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
