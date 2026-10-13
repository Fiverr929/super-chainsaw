export type DesignWorkflow = 'photos' | 'designs';

export type DesignBatchState = {
  kind?: DesignWorkflow;
  alreadyTransparent?: boolean;
  selected?: boolean;
  status: 'waiting' | 'working' | 'ready' | 'error';
  output?: string;
};

/** Older in-memory results can survive Fast Refresh during development. */
export function designWorkflow(item: Pick<DesignBatchState, 'kind' | 'alreadyTransparent'>): DesignWorkflow {
  return item.kind || (item.alreadyTransparent ? 'designs' : 'photos');
}

export function workflowItems<T extends DesignBatchState>(items: T[], workflow: DesignWorkflow): T[] {
  return items.filter(item => designWorkflow(item) === workflow);
}

export function readyDesigns<T extends DesignBatchState>(items: T[]): T[] {
  return items.filter(item => item.status === 'ready' && !!item.output);
}

export function selectedDesigns<T extends DesignBatchState>(items: T[], workflow: DesignWorkflow): T[] {
  return readyDesigns(workflowItems(items, workflow)).filter(item => item.selected);
}
