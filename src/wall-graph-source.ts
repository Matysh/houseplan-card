/** Ephemeral graph authority carried through read projections; never serialized. */
import type { PlanGraph } from './plan-graph';
export interface WallGraphSource {graph:PlanGraph;scale:number}
const sources=new WeakMap<object,WallGraphSource>();
export function registerWallGraph(rooms:object,partitions:object,graph:PlanGraph,scale:number):void {
  const source={graph,scale};sources.set(rooms,source);sources.set(partitions,source);
}
export const wallGraphSource=(value:object|undefined):WallGraphSource|undefined=>value&&sources.get(value);
