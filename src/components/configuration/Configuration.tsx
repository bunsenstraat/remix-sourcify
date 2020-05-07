// import React, {useState} from "react";
// import { Dropdown } from "../common/form/Dropdown"
// import { AddressInput } from "../common/form/AddressInput"
// import {chainOptions} from "../../common/Constants"
// import { remixClient } from "../../remix/RemixClient"
// import {Alert, Spinner} from "../common";
 
// export const Configuration = () => {
//     const [server, setServer] = useState('');
//     const [chainGlobal, setChainGlobal] = useState(false);
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState('');

//     const resetState = () => {
//         setError(null);
//     };

//     const handleSubmit = async (e) => {
//         resetState();
//         e.preventDefault();

//         setLoading(true);
//     };

//     return (
//         <div className="card m-2">
//             <div className="card-body text-center p-3">
//                 <div className="card-header">
//                     <h6 className="card-title m-0">Global configuration</h6>
//                 </div>  
//             <p className="card-text my-2 mb-3">Configure a custom server url or set chain to always use plugin chain (By default it's Remix's chain)</p>
//             <form className="d-flex flex-column" onSubmit={handleSubmit}>
//                 <input className="form-control my-2" type="text" placeholder="Custom server" server={server} setServer={setServer}/>
//                 <div class="form-check">
//                     <input type="checkbox" class="form-check-input" id="globalChain" chainGlobal={chainGlobal} setChainGlobal={setChainGlobal}/>
//                     <label class="form-check-label" for="exampleCheck1">Always use network from plugin</label>
//                 </div>
//                 <button type="submit" className="btn btn-primary my-2 mb-0">Advanced settings</button>
//             </form>
//             </div>
//         </div>
//     )
// }
