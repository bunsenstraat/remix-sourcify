import { PluginClient } from '@remixproject/plugin'
import { createClient } from '@remixproject/plugin-webview'
// import {connectIframe, listenOnThemeChanged} from '@remixproject/plugin';
import axios, { AxiosResponse } from 'axios';
import { toChecksumAddress } from 'web3-utils';
import { REPOSITORY_URL_FULL_MATCH, REPOSITORY_URL_PARTIAL_MATCH, SERVER_URL } from '../common/Constants';
import { FetchResult, VerificationResult } from '../state/types';

const SOURCIFY_DIR = "verified-sources";

export class RemixClient extends PluginClient {

    public client: any;

    constructor() {
        super()
        createClient(this);
        this.methods = ["fetch", "fetchAndSave", "fetchByNetwork", "verify", "verifyByNetwork"];
    }

    createClient = () => {
        return this.onload();
    }

    getFile = async (name: string) => {
        return new Promise(async (resolve, reject) => {
            let path = name.startsWith('./') ? name.substr(2) : name;
            let content = await this.call('fileManager', 'getFile', path);
            if (content) {
                resolve(content);
            } else {
                reject(`Could not find "${name}"`)
            }
        });
    }

    getFolderByAddress = async (address: string)  => {
        return this.call('fileManager', 'getFolder', address)
    }

    getCurrentFile = async () => {
        return this.call('fileManager', 'getCurrentFile');
    }

    createFile = async (name: string, content: any) => {
        try {
            await this.call('fileManager', 'setFile', name, content)
        } catch (err) {
            console.log(err)
        }
    }

    switchFile = async (name: string) => {
        await this.call('fileManager', 'switchFile', name)
    }

    contentImporter = async (stdUrl: string) => {
        return await this.call('contentImport', 'resolve', stdUrl)
    }

    listenOnCompilationFinishedEvent = async (callback: any) => {
        await this.onload();
        this.on('solidity', 'compilationFinished', (target, source, _version, data) => {
            callback({ 
                target, 
                source: source.sources[target].content, 
                contract: data.contracts[target] 
            });
        });
    }

    fetchLastCompilation = async () => {
        await this.onload();
        let result = await this.call('solidity', 'getCompilationResult');

        if (!result.source) {
            throw new Error("Could not get compilation results.");
        }

        const target = result.source.target;
        const contract = result.data.contracts[target];
        const contractName = Object.keys(contract)[0];
        const metadata = new File([contract[contractName].metadata], "metadata.json", { type: "text/plain" });

        const files = [metadata];
        
        for (const sourcePath in result.source.sources) {
            const content = result.source.sources[sourcePath].content;
            const source = new File([content], sourcePath, { type: "text/plain" });
            files.push(source);
        }

        return { files, contractName };
    }

    detectNetwork = async () => {
        await this.onload();
        return await this.call('network', 'detectNetwork')
    }

    fetchAndSave = async (address: string, chain: any): Promise<FetchResult>  => {
        address = toChecksumAddress(address.trim());
        const result: FetchResult = await this.fetchByNetwork(address, chain) ;
        try{
            await this.saveFetchedToRemix(result, address);
        }catch(err){
            throw new Error(`Could not save files. Please check the address you entered. ${err}`)
        }
        return result;
    }

    fetchFiles = async (chain: any, address: string) => {
        const response = await axios.get(`${SERVER_URL}/files/${chain}/${address}`)
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
                let response: AxiosResponse<any>;
                try {
                    response = await this.fetchFiles(chain, address);
                } catch(err) {
                    return reject({info: `This contract could not be loaded. Please check the address. ${err}. Network: ${chain}`}) 
                }

                const fetchResult: FetchResult = {
                    metadata: null,
                    sources: []
                };

                for (const file of response.data) {
                    if (file.name === "metadata.json") {
                        if (fetchResult.metadata) {
                            return reject({ info: "Multiple metadata files fetched" });
                        }
                        fetchResult.metadata = JSON.parse(file.content);

                    } else {
                        fetchResult.sources.push(file);
                    }
                }

                return resolve(fetchResult);
        });
    }

    saveFetchedToRemix = async (fetched: FetchResult, address: string) => {
        address = address.trim();
        const filePrefix = `/${SOURCIFY_DIR}/${address}`;
        try {
            await this.createFile(`${filePrefix}/metadata.json`, JSON.stringify(fetched.metadata, null, '\t'));

            for (const source of fetched.sources) {
                let filePath: string;
                for (const a of [address, toChecksumAddress(address)]) {
                    const matching = source.path.match(`/${a}/(.*)$`);
                    if (matching) {
                        filePath = matching[1];
                        break;
                    }
                }

                if (filePath) {
                    await this.createFile(`${filePrefix}/${filePath}`, source.content);
                } else {
                    throw new Error(`Invalid address (${address})`);
                }
            }

            const compilationTarget = fetched.metadata.settings.compilationTarget;
            const contractPath = Object.keys(compilationTarget)[0];
            await this.switchFile(`${filePrefix}/sources/${contractPath}`);
        } catch(err) {
            throw new Error(`Could not save the files. Please check the address provided. ${err}`);
        }
    }

    verifyByForm = async (formData: any): Promise<VerificationResult> => {
        const verificationResult: VerificationResult = {
            address: formData.get('address'),
            status: 'no match',
            message: ''
        };

        try {
            const response = await axios.post(SERVER_URL, formData)
            verificationResult.status = response.data.result[0].status;
            verificationResult.message = 'Successfully verified';
            const repoUrl = verificationResult.status === "perfect" ? REPOSITORY_URL_FULL_MATCH : REPOSITORY_URL_PARTIAL_MATCH;
            verificationResult.url = `${repoUrl}/${formData.get("chain")}/${verificationResult.address}`;
            verificationResult.storageTimestamp = response.data.result[0].storageTimestamp;
        } catch(e) {
            verificationResult.message = JSON.stringify(e.response.data.error);
        }

        return verificationResult;
    } 

    verify = async (address: string, files: any): Promise<VerificationResult> => {
        let chain = await this.detectNetwork();

        // Use version from plugin if vm is used inside Remix or there is no network at all
        if(typeof chain === "undefined" || chain.id === "-" ) {
            return {
                address: address,
                status: 'no_match', // the underscore _ might be a typo, anyway `status` should be an enum
                message: 'invalid_network'
            }
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
