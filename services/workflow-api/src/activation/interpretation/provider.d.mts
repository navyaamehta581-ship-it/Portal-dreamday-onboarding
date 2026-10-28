export function interpreterFromEnv(): (input:unknown)=>Promise<unknown>;
export function endpointUrl(endpoint:string): {url:URL;local:boolean}|undefined;
export function boundedJson(response:Response): Promise<unknown>;
export function modelConfigFromEnv(env?:Record<string,string|undefined>): {endpoint:string;apiKey:string|undefined;model:string;timeoutMs:number};
