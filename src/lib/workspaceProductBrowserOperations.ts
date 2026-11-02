'use client';

import { artworkForFrame, type WorkspaceProduct } from './workspaceProducts';
import { renderMockup } from './mockupRenderer';

/** Shared resumable render loop used by the manual product editor and Workstation Agent. */
export async function renderWorkspaceProduct(initial: WorkspaceProduct, persist: (product: WorkspaceProduct) => Promise<WorkspaceProduct>): Promise<WorkspaceProduct> {
  const frames=initial.preset.frames.filter(frame=>frame.imageDataUrl);
  if(!frames.length||!initial.designDataUrl)throw new Error('Add artwork and a usable mockup frame before rendering.');
  const recovering=initial.renderState==='rendering'||initial.renderState==='error';
  let current=await persist({...initial,renderState:'rendering',error:undefined,generated:recovering?initial.generated:[]});
  try{
    for(const frame of frames){
      if(current.generated.some(image=>image.id===frame.id))continue;
      const dataUrl=await renderMockup(frame,artworkForFrame(current,frame.role));
      current=await persist({...current,generated:[...current.generated,{id:frame.id,name:`${String(current.generated.length+1).padStart(2,'0')}-${frame.role}.png`,dataUrl}]});
    }
    return await persist({...current,renderState:'ready',error:undefined});
  }catch(error){
    const detail=error instanceof Error?error.message:'Mockup rendering failed.';
    await persist({...current,renderState:'error',error:detail}).catch(()=>undefined);
    throw error;
  }
}
