import {Logo} from './Logo';

/** Reconstruction of reference 010 (“Portal is ready for you”). */
export function Welcome({onStart}:{onStart:()=>void}){
 return <main className="pt-entry">
  <div className="pt-art" role="img" aria-label="Portal artwork"><div className="pt-art-logo"><Logo backstage/></div></div>
  <section className="pt-entry-copy">
   <h1>Portal is ready for you</h1>
   <p>Portal restores order to your microservices and infrastructure and enables your product teams to ship high-quality code quickly.</p>
   <button className="pt-btn" onClick={onStart}>Get started</button>
  </section>
 </main>;
}
