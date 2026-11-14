/** Minimal reference embedder: an absent SDK cannot draw its own error. */
export async function loadStandaloneReference(container,entryUrl,host,options,errorText){
  let mounted;
  try{
    const {mountHouseplan}=await import(entryUrl);
    mounted=mountHouseplan(container,host,options);await mounted.ready;return mounted;
  }catch(error){
    if(mounted)return mounted; // Its own localized notice is already visible.
    const notice=document.createElement('div');notice.className='hpf-notice';notice.setAttribute('role','alert');
    notice.textContent=errorText;container.append(notice);
    return {error,dispose(){notice.remove();}};
  }
}
