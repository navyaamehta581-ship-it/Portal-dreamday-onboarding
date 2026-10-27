/** Portal mark approximated with SVG; the official asset is not in the repository. */
export function Mark({className='mark'}:{className?:string}){
 return <svg className={className} viewBox="0 0 34 34" aria-hidden="true"><circle cx="18" cy="16" r="14" fill="currentColor"/><circle cx="16" cy="18" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg>;
}
export function Logo({backstage=false}:{backstage?:boolean}){
 return <span className="pt-logo"><Mark/><span><b>Spotify Portal</b>{backstage&&<> for Backstage</>}</span>{backstage&&<span className="beta">BETA</span>}</span>;
}
