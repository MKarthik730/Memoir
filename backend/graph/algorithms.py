"""
Graph algorithms operating on the People + Relationship tables.

Relationships form an undirected graph where nodes are Person records
and edges are Relationship records.

Algorithms:
  - shortest_path: BFS O(V + E)
  - detect_communities: Union-Find connected components O(E α(V))
  - centrality_ranking: Degree centrality O(V)

All functions accept raw data (list of people + list of edges) so they
are testable without a database connection.
"""
from collections import defaultdict, deque
from typing import List, Dict, Tuple, Optional


def build_adjacency_list(
    people: List[Dict],
    relationships: List[Dict],
) -> Dict[str, List[Tuple[str, str]]]:
    """Build an adjacency list from people and relationships.

    Args:
        people: List of dicts with at least {"id": str, "name": str}.
        relationships: List of dicts with at least
            {"person_a": {"id": str}, "person_b": {"id": str}, "label": str}.

    Returns:
        Dict mapping person_id -> [(neighbor_id, edge_label), ...].

    Complexity: O(E) where E = number of relationships.
    """
    adj = defaultdict(list)
    for rel in relationships:
        a_id = rel["person_a"]["id"]
        b_id = rel["person_b"]["id"]
        label = rel.get("label", "")
        adj[a_id].append((b_id, label))
        adj[b_id].append((a_id, label))
    return dict(adj)


def shortest_path(
    person_a_id: str,
    person_b_id: str,
    adj: Dict[str, List[Tuple[str, str]]],
    people_map: Dict[str, str],
) -> Optional[Dict]:
    """Find the shortest path between two people in the family graph.

    Args:
        person_a_id: UUID of the starting person.
        person_b_id: UUID of the target person.
        adj: Adjacency list from build_adjacency_list().
        people_map: Dict mapping person_id -> person_name.

    Returns:
        Dict with:
          - path: List of {"id", "name", "edge_label"} nodes along the path
          - degree: Integer degree of separation (edge count)
        Or None if no path exists.

    Complexity: O(V + E) — BFS traversal.
    """
    if person_a_id == person_b_id:
        return {
            "path": [{"id": person_a_id, "name": people_map.get(person_a_id, "Unknown"), "edge_label": ""}],
            "degree": 0,
        }

    visited = {person_a_id}
    queue = deque([(person_a_id, [])])  # (current_node, path_edges_so_far)

    while queue:
        current, path_edges = queue.popleft()

        for neighbor_id, edge_label in adj.get(current, []):
            if neighbor_id == person_b_id:
                # Found the target
                full_path = path_edges + [(current, neighbor_id, edge_label)]
                path_nodes = []
                for i, (src, dst, lbl) in enumerate(full_path):
                    if i == 0:
                        path_nodes.append({
                            "id": src,
                            "name": people_map.get(src, "Unknown"),
                            "edge_label": "",
                        })
                    path_nodes.append({
                        "id": dst,
                        "name": people_map.get(dst, "Unknown"),
                        "edge_label": lbl,
                    })
                return {
                    "path": path_nodes,
                    "degree": len(full_path),
                }

            if neighbor_id not in visited:
                visited.add(neighbor_id)
                queue.append((neighbor_id, path_edges + [(current, neighbor_id, edge_label)]))

    return None


def detect_communities(
    adj: Dict[str, List[Tuple[str, str]]],
    people_map: Dict[str, str],
) -> List[Dict]:
    """Detect connected components (communities) in the family graph.

    Uses Union-Find (Disjoint Set Union) for O(E α(V)) complexity.

    Args:
        adj: Adjacency list from build_adjacency_list().
        people_map: Dict mapping person_id -> person_name.

    Returns:
        List of communities, each a dict with:
          - id: int community ID
          - members: List of {"id": str, "name": str}
          - size: int number of members

    Complexity: O(E α(V)) where α is the inverse Ackermann function.
    """
    # Union-Find data structure
    parent = {}
    rank = {}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]  # Path compression
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx == ry:
            return
        if rank[rx] < rank[ry]:
            parent[rx] = ry
        elif rank[rx] > rank[ry]:
            parent[ry] = rx
        else:
            parent[ry] = rx
            rank[rx] += 1

    # Initialize all nodes
    for node_id in people_map:
        parent[node_id] = node_id
        rank[node_id] = 0

    # Union connected nodes
    for node_id, neighbors in adj.items():
        for neighbor_id, _ in neighbors:
            union(node_id, neighbor_id)

    # Collect members by root
    communities = defaultdict(list)
    for node_id in people_map:
        root = find(node_id)
        communities[root].append({"id": node_id, "name": people_map[node_id]})

    # Format output
    result = []
    for i, (root, members) in enumerate(communities.items()):
        result.append({
            "id": i,
            "root_person_id": root,
            "members": members,
            "size": len(members),
        })

    # Sort by size descending
    result.sort(key=lambda c: c["size"], reverse=True)
    return result


def centrality_ranking(
    adj: Dict[str, List[Tuple[str, str]]],
    people_map: Dict[str, str],
) -> List[Dict]:
    """Rank people by degree centrality (number of direct connections).

    Args:
        adj: Adjacency list from build_adjacency_list().
        people_map: Dict mapping person_id -> person_name.

    Returns:
        List of dicts sorted by centrality descending, each with:
          - id: str person UUID
          - name: str person name
          - degree: int number of connections
          - centrality: float normalized 0-1

    Complexity: O(V) — single pass over adjacency list.
    """
    max_degree = max((len(adj.get(pid, [])) for pid in people_map), default=1)

    rankings = []
    for pid, name in people_map.items():
        degree = len(adj.get(pid, []))
        rankings.append({
            "id": pid,
            "name": name,
            "degree": degree,
            "centrality": degree / max_degree if max_degree > 0 else 0,
        })

    rankings.sort(key=lambda r: r["degree"], reverse=True)
    return rankings


def get_neglected_connections(
    people_with_last_memory: List[Dict],
    threshold_days: int = 90,
) -> List[Dict]:
    """Find people with the longest gap since their last memory.

    Args:
        people_with_last_memory: List of dicts with at least
            {"person_id": str, "person_name": str, "days_since_last_memory": int}.
        threshold_days: Minimum days to consider "neglected" (default 90).

    Returns:
        List of dicts sorted by days_since_last_memory descending.

    Complexity: O(V log V) for sorting.
    """
    neglected = [p for p in people_with_last_memory
                 if p.get("days_since_last_memory", 0) >= threshold_days]
    neglected.sort(key=lambda p: p["days_since_last_memory"], reverse=True)
    return neglected
