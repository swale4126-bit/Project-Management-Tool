/**
 * Directed Acyclic Graph (DAG) cycle detector for task dependencies.
 *
 * Edge semantics: `taskId` depends on `dependsOnTaskId` (taskId -> dependsOnTaskId).
 * Adding edge (taskId -> dependsOnTaskId) creates a cycle iff `taskId` is already
 * reachable starting from `dependsOnTaskId` by following existing dependency edges.
 *
 * @param {Array<{ task_id: string, depends_on_task_id: string }>} existingEdges
 * @param {string} taskId
 * @param {string} dependsOnTaskId
 * @returns {boolean} true if adding this dependency would introduce a cycle
 */
export function wouldCreateCycle(existingEdges, taskId, dependsOnTaskId) {
  if (taskId === dependsOnTaskId) {
    return true;
  }

  const adjacency = new Map();
  for (const edge of existingEdges) {
    if (!adjacency.has(edge.task_id)) {
      adjacency.set(edge.task_id, []);
    }
    adjacency.get(edge.task_id).push(edge.depends_on_task_id);
  }

  const visited = new Set();
  const queue = [dependsOnTaskId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === taskId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const nextNodes = adjacency.get(current) || [];
    for (const next of nextNodes) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  return false;
}
