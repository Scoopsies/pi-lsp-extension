export type RuntimeAccessorsRuntime<M extends object, F, T extends object, W extends object> = {
  getManager: () => M;
  getFileSync: () => F;
  getTreeSitter: () => T;
  getWorkspaceIndex: () => W;
};

export function createRuntimeAccessors<M extends object, F, T extends object, W extends object>(
  runtime: RuntimeAccessorsRuntime<M, F, T, W>,
  getManagerOrNull: () => M | null,
) {
  const getManager = (): M => runtime.getManager();
  const getFileSync = (): F => runtime.getFileSync();
  const getTreeSitter = (): T => runtime.getTreeSitter();
  const getWorkspaceIndex = (): W => runtime.getWorkspaceIndex();

  const managerProxy = new Proxy({} as M, {
    get(_target, prop) {
      return (getManager() as any)[prop];
    },
  });

  const treeSitterProxy = new Proxy({} as T, {
    get(_target, prop) {
      return (getTreeSitter() as any)[prop];
    },
  });

  const workspaceIndexProxy = new Proxy({} as W, {
    get(_target, prop) {
      return (getWorkspaceIndex() as any)[prop];
    },
  });

  return {
    getManager,
    getFileSync,
    getTreeSitter,
    getWorkspaceIndex,
    getManagerOrNull,
    managerProxy,
    treeSitterProxy,
    workspaceIndexProxy,
  };
}
