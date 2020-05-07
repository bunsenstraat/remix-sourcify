import {connectIframe, listenOnThemeChanged} from '@remixproject/plugin';
import { Api, createIframeClient, PluginClient, RemixApi } from '@remixproject/plugin';
import axios from 'axios';
import { SERVER_URL } from '../common/Constants';
import { FetchResult } from '../state/types';

export class RemixClient extends PluginClient {

    private client: PluginClient<any> = createIframeClient<Api, RemixApi>();

    constructor() {
        super();
        this.methods = ["fetch", "verify"];
        connectIframe(this.client);
        listenOnThemeChanged(this.client);
    }

    createClient = () => {
        console.log("Loading client")
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

    getBrowserPath = (path: string) => {
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

    detectNetwork = async () => {
        await this.client.onload();
        return await this.client.call('network', 'detectNetwork')
    }

    fetchAndSave = async (address: string, chain: any) => {
        const result: any = await this.fetch(address, chain) 
        await this.saveFetchedToRemix(result.metadata, result.contract, address)       
    }

    fetchFiles = async (chain: any, address: string) => {
        let response: any;

        try{
            response = await axios.get(`${SERVER_URL}/files/${chain.name}/${address}`)
        } catch(err) {
            response = err.response;
        }

        return response;
    }

    fetchByNetwork = async(address: string) => {
        return new Promise(async (resolve, reject) => {   

            let chain = await this.detectNetwork()

            // Use version from plugin if vm is used inside Remix or there is no network at all
            if(typeof chain === "undefined" || chain.id === "-" ) {
                return reject({info: `No a valid network ${chain}`}) 
            }

            return resolve(await this.fetch(address, chain));
        })
    }

    fetch = async (address: string, chain: any) => {
        return new Promise(async (resolve, reject) => {   
                let response = await this.fetchFiles(chain, address);
                
                if(response.data.error) {
                    return reject({info: `${response.data.error}. Network: ${chain.name}`}) 
                }
            
                let metadata;
                let contract;
                for(let i in response.data){
                    const file = response.data[i];
                    if(file.name.endsWith('json')){
                        metadata = JSON.parse(file.content);
                    } else if (file.name.endsWith('sol')){
                        contract = file.content;
                    }
                };

                let fetchResult: FetchResult;
                fetchResult.contract = contract;
                fetchResult.metadata = metadata;

                console.log(fetchResult);
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

    verifyByForm = async (formData: any) => {
        return axios.post(`${SERVER_URL}`, formData);
    } 


    //TODO: finish 
    verify = async (address: string, chain: any, files: any) => {
        // const sol = new File([data.source], data.target.replace("browser/", ""), { type: "text/plain" });
        // const metadata = new File([contract.metadata], "metadata.json", { type: "text/plain" });
        const formData = new FormData();
        formData.append("address", address);
        formData.append("chain", chain);
        // files.forEach(file => {
        //     const localFile = new File([])
        //     formData.append('files', file)
        // });
        return this.verifyByForm(formData);
    }
}

export const remixClient = new RemixClient()
