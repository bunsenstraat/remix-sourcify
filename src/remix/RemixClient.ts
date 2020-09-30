import {connectIframe, listenOnThemeChanged} from '@remixproject/plugin';
import { Api, createIframeClient, PluginClient, RemixApi } from '@remixproject/plugin';
import axios from 'axios';
import { SERVER_URL } from '../common/Constants';
import { FetchResult, VerificationResult } from '../state/types';

export class RemixClient extends PluginClient {

    public client: any;

    constructor() {
        super();
        this.methods = ["fetch", "fetchAndSave", "fetchByNetwork", "verify", "verifyByNetwork"];
        connectIframe(this);
        listenOnThemeChanged(this);
        this.client = this;
    }

    createClient = () => {
        return this.client.onload();
    }

    getFile = async (name: string) => {
        return new Promise(async (resolve, reject) => {
            let path = name.startsWith('./') ? name.substr(2) : name;
            let content = await this.client.call('fileManager', 'getFile', this.getBrowserPath(path));
            if (content) {
                resolve(content);
            } else {
                reject(`Could not find "${name}"`)
            }
        });
    }

    getFolderByAddress = async (address: string)  => {
        return this.client.call('fileManager', 'getFolder', this.getBrowserPath(address))
    }

    getCurrentFile = async () => {
        return this.client.call('fileManager', 'getCurrentFile');
    }

    createFile = async (name: string, content: any) => {
        try {
            await this.client.call('fileManager', 'setFile', name, content)
        } catch (err) {
            console.log(err)
        }
    }

    switchFile = async (name: string) => {
        await this.client.call('fileManager', 'switchFile', name)
    }

    getBrowserPath = (path: string): string => {
        if (path.startsWith('browser/')) {
            return path;
        }
        return `browser/${path}`;
    }

    contentImport = async (stdUrl: string) => {
        return await this.client.call('contentImport', 'resolve', stdUrl)
    }

    listenOnCompilationFinishedEvent = async (callback: any) => {
        await this.client.onload();
        this.client.on('solidity', 'compilationFinished', (target, source, _version, data) => {
            callback({ 
                target, 
                source: source.sources[target].content, 
                contract: data.contracts[target] 
            });
        });
    }

    fetchLastCompilation = async () => {
        await this.client.onload();
        let result = await this.client.call('solidity', 'getCompilationResult');
        let files = [];

        let metadata;
        const target = result.source.target;
        const sol = new File([result.source.sources[target.toString()].content], result.source.target.replace("browser/", ""), { type: "text/plain" });

        Object.keys(result.data.contracts).forEach(key => {
            Object.keys(result.data.contracts[key]).forEach(nestedKey => {
                 metadata = new File([result.data.contracts[key][nestedKey].metadata], "metadata.json", { type: "text/plain" });
            })
        });


        console.log(sol);
        console.log(metadata)

        files.push(sol, metadata);

        return files;
    }

    detectNetwork = async () => {
        await this.client.onload();
        return await this.client.call('network', 'detectNetwork')
    }

    fetchAndSave = async (address: string, chain: any): Promise<FetchResult>  => {
        const result: FetchResult = await this.fetchByNetwork(address, chain) 
        await this.saveFetchedToRemix(result.metadata, result.contract, address)
        return result;
    }

    fetchFiles = async (chain: any, address: string) => {
        let response: any;

        try{
            response = await axios.get(`${SERVER_URL}/files/${chain}/${address}`)
        } catch(err) {
            response = err.response;
        }

        return response;
    }

    fetch = async(address: string): Promise<FetchResult> => {
        return new Promise(async (resolve, reject) => {   

            let chain = await this.detectNetwork()

            // Use version from plugin if vm is used inside Remix or there is no network at all
            if(typeof chain === "undefined" || chain.id === "-" ) {
                return reject({info: `No a valid network ${chain}`}) 
            }

            let fetchResult: FetchResult = await this.fetchByNetwork(address, chain.id);
            return resolve(fetchResult);
        })
    }

    fetchByNetwork = async (address: string, chain: any): Promise<FetchResult> => {
        return new Promise(async (resolve, reject) => {   
                let response = await this.fetchFiles(chain, address);
                
                if(response.data.error) {
                    console.log(response.data.error);
                    return reject({info: `${response.data.error}. Network: ${chain}`}) 
                }
            
                let fetchResult: FetchResult = {
                    metadata:'',
                    contract:'',
                };

                for(let i in response.data){
                    const file = response.data[i];
                    if(file.name.endsWith('json')){
                        fetchResult.metadata = JSON.parse(file.content);
                    } else if (file.name.endsWith('sol')){
                        fetchResult.contract = file.content;
                    }
                };

                return resolve(fetchResult);
        });
    }

    saveFetchedToRemix = async (metadata: any, contract: any, address: string) => {
            this.createFile(`/verified-sources/${address}/metadata.json`, JSON.stringify(metadata, null, '\t'))
            let switched = false
            for (let file in metadata['sources']) {
                const urls = metadata['sources'][file].urls
                for (let url of urls) {
                    if (url.includes('ipfs')) {
                        let stdUrl = `ipfs://${url.split('/')[2]}`
                        const source = await this.contentImport(stdUrl)
                        file = file.replace('browser/', '')
                        if(source.content) this.createFile(`/verified-sources/${address}/${file}`, source.content)
                        if (!switched) await this.switchFile(`/verified-sources/${address}/${file}`)
                        switched = true
                        break
                    }
                }
            }
    }

    verifyByForm = async (formData: any): Promise<VerificationResult> => {
        const verifyResult: VerificationResult = [{
            address: formData.get('address'),
            status: '',
            message: ''
        }]

        let response: any; 
        try {
            response = await axios.post(`${SERVER_URL}`, formData)
            verifyResult[0].status =  response.data.result[0].status;
            verifyResult[0].message = 'Successfully verified';
        } catch(e) {
            verifyResult[0].status = 'no match';
            verifyResult[0].message = JSON.stringify(e.response.data.error);
        }

        return verifyResult;
    } 

    verify = async (address: string, files: any): Promise<VerificationResult> => {
        let chain = await this.detectNetwork()

        // Use version from plugin if vm is used inside Remix or there is no network at all
        if(typeof chain === "undefined" || chain.id === "-" ) {
            return [{
                address: address,
                status: 'no_match',
                message: 'invalid_network'
            }]        
        }

        return await this.verifyByNetwork(address, chain.id, files);
    }

    verifyByNetwork = async (address: string, chain: string | number, files: any): Promise<VerificationResult> => {
        const formData = new FormData();

        formData.append('address', address);
        formData.append('chain', chain.toString());

        if (files.length > 0) {
            files.forEach((file: any) => formData.append('files', file));
        }

       
        return await this.verifyByForm(formData);
    }
}

export const remixClient = new RemixClient()
