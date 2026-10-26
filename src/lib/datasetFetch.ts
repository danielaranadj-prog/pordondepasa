import manifest from './dataset-manifest.json' with {type:'json'};
export class DatasetChangedError extends Error{}
export async function fetchDataset<T>(name:keyof typeof manifest.files,fetcher:typeof fetch=fetch):Promise<T>{
 const response=await fetcher(`${import.meta.env?.BASE_URL??'/'}data/${name}`,{cache:'no-cache'});
 if(!response.ok)throw new Error('Datos no disponibles');
 const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
 const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!==manifest.files[name])throw new DatasetChangedError('Los datos cambiaron. Actualiza la aplicación antes de calcular otro viaje.');
 return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
